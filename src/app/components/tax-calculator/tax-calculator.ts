import { Component, inject, NgZone, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, filter, finalize } from 'rxjs';
import { DocumentService } from '../../core/services/document.service';
import { W2SharedService } from '../../core/services/w2-shared.service';
import { CalculatorResultService, CalculatorResult } from '../../core/services/calculator-result.service';
import { CalculatorApiService } from '../../core/services/calculator-api.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { DocumentType, OcrConfidence, Document } from '../../core/models';

type CalculatorState = 'loading' | 'upload' | 'calculating' | 'result' | 'already-calculated';

@Component({
  selector: 'app-tax-calculator',
  imports: [CommonModule],
  templateUrl: './tax-calculator.html',
  styleUrl: './tax-calculator.css'
})
export class TaxCalculator implements OnInit, OnDestroy {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private documentService = inject(DocumentService);
  private w2SharedService = inject(W2SharedService);
  private calculatorResultService = inject(CalculatorResultService);
  private calculatorApiService = inject(CalculatorApiService);
  private dataRefreshService = inject(DataRefreshService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();
  private isLoadingInProgress = false;

  state: CalculatorState = 'loading';
  existingW2: Document | null = null;
  savedCalculatorResult: CalculatorResult | null = null;
  uploadedFile: File | null = null;
  isDragging = false;
  estimatedRefund = 0;
  calculationProgress = 0;

  // Result breakdown
  box2Federal = 0;
  box17State = 0;
  ocrConfidence: OcrConfidence = 'high';
  errorMessage = '';

  // Auto-save states
  isSavingDocument = false;
  documentSaved = false;
  isFromDocuments = false;

  ngOnInit() {
    this.checkExistingW2();

    // Check if coming from documents with a W2 already uploaded
    this.subscriptions.add(
      this.w2SharedService.w2Uploaded$.subscribe(event => {
        if (event && event.source === 'documents') {
          this.isFromDocuments = true;
          this.documentSaved = true;
          // Start calculation automatically since doc is already saved
          this.startCalculation();
        }
      })
    );

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects === '/tax-calculator')
      ).subscribe(() => this.checkExistingW2())
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/tax-calculator').subscribe(() => this.checkExistingW2())
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /**
   * Check if user already has a W2 document and/or calculator result
   */
  checkExistingW2() {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;
    this.state = 'loading';

    // Check for saved calculator result first
    this.savedCalculatorResult = this.calculatorResultService.getResult();

    this.documentService.getDocuments().pipe(
      finalize(() => {
        this.isLoadingInProgress = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (docs) => {
        this.existingW2 = docs.find(d => d.type === DocumentType.W2) || null;

        // Determine which state to show
        if (this.existingW2 && this.savedCalculatorResult) {
          // User has both W2 and calculator result - show already calculated
          this.estimatedRefund = this.savedCalculatorResult.estimatedRefund;
          this.state = 'already-calculated';
        } else if (this.existingW2) {
          // User has W2 but no calculator result - they can recalculate
          this.state = 'upload';
        } else {
          // No W2 - show upload screen
          this.state = 'upload';
        }
      },
      error: () => {
        // Error loading - default to upload screen
        this.state = 'upload';
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File) {
    console.log('=== CALCULATOR: File received ===', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Backend only accepts JPG/PNG (not PDF/WEBP)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      console.warn('=== CALCULATOR: Invalid file type ===', file.type);
      alert('Solo archivos JPG y PNG son compatibles con el análisis automático. Por favor convierte tu W2 a uno de estos formatos.');
      return;
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      console.warn('=== CALCULATOR: File too large ===', file.size);
      alert('El archivo es demasiado grande (máximo 25MB).');
      return;
    }

    this.uploadedFile = file;
    // Store file in service for persistence
    this.calculatorApiService.setCurrentFile(file);
    this.startCalculation();
  }

  startCalculation() {
    console.log('=== CALCULATOR: Starting calculation ===');
    console.log('File from component:', this.uploadedFile?.name);
    console.log('File from service:', this.calculatorApiService.getCurrentFile()?.name);
    console.log('Is from documents:', this.isFromDocuments);

    this.state = 'calculating';
    this.calculationProgress = 0;
    this.errorMessage = '';

    // Try to get file from service if not in component state
    const fileToProcess = this.uploadedFile || this.calculatorApiService.getCurrentFile();

    // If no file available, use mock calculation (demo mode)
    if (!fileToProcess) {
      console.warn('=== CALCULATOR: No file found, running DEMO MODE (random numbers) ===');
      this.runMockCalculation();
      return;
    }

    console.log('=== CALCULATOR: File found, calling API for real OCR analysis ===', fileToProcess.name);

    // Validate file before API call
    if (fileToProcess.size === 0) {
      console.error('=== CALCULATOR: File has no content (size = 0) ===');
      this.errorMessage = 'El archivo está vacío. Por favor sube un W2 válido.';
      this.state = 'upload';
      return;
    }

    // Start progress animation
    const progressInterval = setInterval(() => {
      if (this.calculationProgress < 90) {
        this.calculationProgress += Math.random() * 10 + 3;
        this.cdr.detectChanges();
      }
    }, 500);

    // Call real API with OCR
    this.calculatorApiService.estimateRefund(fileToProcess).subscribe({
      next: (response) => {
        clearInterval(progressInterval);
        this.calculationProgress = 100;
        console.log('=== CALCULATOR: API response received ===', response);

        this.box2Federal = response.box2Federal;
        this.box17State = response.box17State;
        this.estimatedRefund = response.estimatedRefund;
        this.ocrConfidence = response.ocrConfidence;

        setTimeout(() => {
          this.showResult();
        }, 600);
        this.cdr.detectChanges();
      },
      error: (error) => {
        clearInterval(progressInterval);
        console.error('=== CALCULATOR: API ERROR ===', error);
        console.error('Error status:', error.status);
        console.error('Error details:', error.error);

        // Provide specific error messages based on error type
        let errorMsg = 'Error al procesar el documento.';

        if (error.status === 400) {
          errorMsg = 'Archivo inválido. Asegúrate de subir un W2 válido en formato JPG o PNG.';
        } else if (error.status === 401) {
          errorMsg = 'Sesión expirada. Por favor inicia sesión nuevamente.';
        } else if (error.status === 413) {
          errorMsg = 'El archivo es demasiado grande. Intenta con una imagen más pequeña.';
        } else if (error.status === 500) {
          errorMsg = 'Error del servidor. Nuestro equipo ha sido notificado. Intenta nuevamente en unos minutos.';
        } else if (error.error?.message) {
          errorMsg = error.error.message;
        }

        this.errorMessage = errorMsg;
        this.state = 'upload';
        this.cdr.detectChanges();
      }
    });
  }

  runMockCalculation() {
    console.log('=== CALCULATOR: DEMO MODE - Generating random values (NOT using API) ===');

    // Demo mode with simulated progress
    this.ngZone.runOutsideAngular(() => {
      const progressInterval = setInterval(() => {
        this.ngZone.run(() => {
          this.calculationProgress += Math.random() * 15 + 5;
          if (this.calculationProgress >= 100) {
            this.calculationProgress = 100;
            clearInterval(progressInterval);

            // Generate mock random values
            this.box2Federal = Math.floor(Math.random() * 1500) + 500;
            this.box17State = Math.floor(Math.random() * 500) + 200;
            this.estimatedRefund = this.box2Federal + this.box17State;
            this.ocrConfidence = 'high';

            console.log('=== CALCULATOR: DEMO results (random) ===', {
              box2Federal: this.box2Federal,
              box17State: this.box17State,
              total: this.estimatedRefund
            });

            setTimeout(() => {
              this.showResult();
            }, 600);
          }
        });
      }, 400);
    });
  }

  showResult() {
    this.state = 'result';

    // Save the calculator result
    this.calculatorResultService.saveResult(
      this.estimatedRefund,
      this.uploadedFile?.name
    );

    // AUTO-SAVE: If W2 was uploaded here (not from documents), automatically save it
    // This triggers the W2_UPLOADED event which advances client progress
    if (this.uploadedFile && !this.isFromDocuments && !this.documentSaved) {
      this.autoSaveW2();
    }
    this.cdr.detectChanges();
  }

  /**
   * Automatically save the W2 to documents after successful calculation
   * This triggers progress automation (W2_UPLOADED event) and updates dashboard progress to 25%
   */
  private autoSaveW2() {
    if (!this.uploadedFile) return;

    console.log('=== CALCULATOR: Auto-saving W2 to documents ===');
    this.isSavingDocument = true;

    this.documentService.upload(this.uploadedFile, DocumentType.W2).subscribe({
      next: (response) => {
        console.log('=== CALCULATOR: W2 auto-saved successfully ===', response);
        this.isSavingDocument = false;
        this.documentSaved = true;

        // Trigger dashboard refresh so "Tu Progreso" updates to show W2 uploaded (+25%)
        this.dataRefreshService.refreshDashboard();

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('=== CALCULATOR: Failed to auto-save W2 ===', error);
        this.isSavingDocument = false;
        // Don't show error to user - they can still use calculator results
        // They can manually upload later in documents section
        this.cdr.detectChanges();
      }
    });
  }

  resetCalculator() {
    console.log('=== CALCULATOR: Resetting calculator ===');
    this.state = 'upload';
    this.uploadedFile = null;
    this.calculatorApiService.clearCurrentFile(); // Clear service file reference
    this.estimatedRefund = 0;
    this.calculationProgress = 0;
    this.box2Federal = 0;
    this.box17State = 0;
    this.ocrConfidence = 'high';
    this.errorMessage = '';
    this.isSavingDocument = false;
    this.documentSaved = false;
    this.isFromDocuments = false;
  }

  getConfidenceLabel(): string {
    const labels = {
      high: 'Alta confianza',
      medium: 'Confianza media',
      low: 'Baja confianza'
    };
    return labels[this.ocrConfidence] || 'Alta confianza';
  }

  getConfidenceClass(): string {
    return `confidence-${this.ocrConfidence}`;
  }

  runDemo() {
    this.isFromDocuments = true; // Demo mode - no auto-save needed
    this.startCalculation();
  }

  startProcess() {
    this.router.navigate(['/tax-form']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}

