import { Component, inject, NgZone, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, filter, finalize, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DocumentService } from '../../core/services/document.service';
import { W2SharedService } from '../../core/services/w2-shared.service';
import { CalculatorResultService, CalculatorResult } from '../../core/services/calculator-result.service';
import { CalculatorApiService } from '../../core/services/calculator-api.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ConfettiService } from '../../core/services/confetti.service';
import { DocumentType, OcrConfidence, Document } from '../../core/models';
import { APP_CONSTANTS } from '../../core/constants/app.constants';

type CalculatorState = 'loading' | 'upload' | 'calculating' | 'result' | 'already-calculated';

@Component({
  selector: 'app-tax-calculator',
  imports: [CommonModule],
  templateUrl: './tax-calculator.html',
  styleUrl: './tax-calculator.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxCalculator implements OnInit, OnDestroy {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private documentService = inject(DocumentService);
  private w2SharedService = inject(W2SharedService);
  private calculatorResultService = inject(CalculatorResultService);
  private calculatorApiService = inject(CalculatorApiService);
  private dataRefreshService = inject(DataRefreshService);
  private confettiService = inject(ConfettiService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();
  private apiSubscription: Subscription | null = null;
  private isLoadingInProgress = false;
  private activeIntervals: ReturnType<typeof setInterval>[] = [];

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
    // Skip the initial BehaviorSubject replay by only reacting to fresh events
    this.subscriptions.add(
      this.w2SharedService.w2Uploaded$.pipe(
        filter(event => {
          if (!event || event.source !== 'documents') return false;
          // Only process if user doesn't already have a calculated result
          // This prevents recalculation when navigating back
          const existingResult = this.calculatorResultService.getResult();
          if (existingResult) {
            return false;
          }
          return true;
        })
      ).subscribe(event => {
        if (event) {
          this.isFromDocuments = true;
          this.documentSaved = true;
          // Clear the event to prevent replay on subsequent navigations
          this.w2SharedService.clear();
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
    if (this.apiSubscription) {
      this.apiSubscription.unsubscribe();
    }
    // Clear any active intervals to prevent memory leaks
    this.clearAllIntervals();
  }

  private clearAllIntervals() {
    this.activeIntervals.forEach(interval => clearInterval(interval));
    this.activeIntervals = [];
  }

  /**
   * Check if user already has a W2 document and/or calculator result
   * IMPORTANT: Fetches from BACKEND first to ensure cross-device sync
   */
  checkExistingW2() {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;

    // Check localStorage FIRST for cached calculator result (instant)
    const cachedResult = this.calculatorResultService.getResult();
    if (cachedResult) {
      this.estimatedRefund = cachedResult.estimatedRefund;
      this.box2Federal = cachedResult.box2Federal || 0;
      this.box17State = cachedResult.box17State || 0;
      this.ocrConfidence = (cachedResult.ocrConfidence as OcrConfidence) || 'high';
      this.savedCalculatorResult = cachedResult;
      this.state = 'already-calculated';
      this.cdr.detectChanges();
    } else {
      this.state = 'loading';
    }

    // Fetch both documents AND backend estimate in parallel (to sync/update)
    forkJoin({
      documents: this.documentService.getDocuments().pipe(
        catchError(() => of([] as Document[]))
      ),
      backendEstimate: this.calculatorApiService.getLatestEstimate().pipe(
        catchError(() => of(null))
      )
    }).pipe(
      finalize(() => {
        this.isLoadingInProgress = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (results) => {
        this.existingW2 = results.documents.find(d => d.type === DocumentType.W2) || null;

        // Check if backend has an existing estimate (cross-device sync)
        const backendData = results.backendEstimate as any;
        if (backendData?.hasEstimate && backendData?.estimate) {
          const estimate = backendData.estimate;

          // Sync backend estimate to local storage and service
          this.calculatorResultService.syncFromBackend({
            estimatedRefund: estimate.estimatedRefund,
            w2FileName: estimate.w2FileName,
            box2Federal: estimate.box2Federal,
            box17State: estimate.box17State,
            ocrConfidence: estimate.ocrConfidence,
            createdAt: estimate.createdAt
          });

          // Populate component state with backend data
          this.estimatedRefund = estimate.estimatedRefund;
          this.box2Federal = estimate.box2Federal || 0;
          this.box17State = estimate.box17State || 0;
          this.ocrConfidence = estimate.ocrConfidence || 'high';
          this.savedCalculatorResult = this.calculatorResultService.getResult();

          // Show already-calculated state - user cannot recalculate
          this.state = 'already-calculated';
          return;
        }

        // No backend estimate - check localStorage as fallback
        this.savedCalculatorResult = this.calculatorResultService.getResult();

        if (this.savedCalculatorResult) {
          // Has local result but not in backend (edge case) - show it
          this.estimatedRefund = this.savedCalculatorResult.estimatedRefund;
          this.state = 'already-calculated';
        } else {
          // No estimate anywhere - show upload screen
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
    // Backend accepts JPG/PNG and PDF (PDF is converted to image on backend)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Formatos aceptados: JPG, PNG, PDF. Por favor sube tu W2 en uno de estos formatos.');
      return;
    }

    // Validate file size (max 25MB)
    const maxSize = APP_CONSTANTS.MAX_FILE_SIZE_BYTES;
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande (máximo 25MB).');
      return;
    }

    this.uploadedFile = file;
    // Store file in service for persistence
    this.calculatorApiService.setCurrentFile(file);
    this.startCalculation();
  }

  startCalculation() {
    this.state = 'calculating';
    this.calculationProgress = 0;
    this.errorMessage = '';

    // Try to get file from service if not in component state
    const fileToProcess = this.uploadedFile || this.calculatorApiService.getCurrentFile();

    // If no file available, return to upload state (don't run demo mode automatically)
    if (!fileToProcess) {
      this.state = 'upload';
      this.errorMessage = 'Por favor sube un documento W2 para calcular tu reembolso.';
      this.cdr.detectChanges();
      return;
    }

    // Validate file before API call
    if (fileToProcess.size === 0) {
      this.errorMessage = 'El archivo está vacío. Por favor sube un W2 válido.';
      this.state = 'upload';
      return;
    }

    // Start progress animation (track interval for cleanup)
    const progressInterval = setInterval(() => {
      if (this.calculationProgress < 90) {
        this.calculationProgress += Math.random() * 10 + 3;
        this.cdr.detectChanges();
      }
    }, 500);
    this.activeIntervals.push(progressInterval);

    // Call real API with OCR
    this.apiSubscription = this.calculatorApiService.estimateRefund(fileToProcess).subscribe({
      next: (response) => {
        clearInterval(progressInterval);
        this.activeIntervals = this.activeIntervals.filter(i => i !== progressInterval);
        this.calculationProgress = 100;

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
        this.activeIntervals = this.activeIntervals.filter(i => i !== progressInterval);

        // Provide specific error messages based on error type
        let errorMsg = 'Error al procesar el documento.';

        if (error.status === 400) {
          errorMsg = 'Archivo inválido. Asegúrate de subir un W2 válido en formato JPG, PNG o PDF.';
        } else if (error.status === 401) {
          errorMsg = 'Sesión expirada. Por favor inicia sesión nuevamente.';
        } else if (error.status === 408) {
          errorMsg = 'El procesamiento tardó demasiado. Por favor, intentá de nuevo.';
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
    // Demo mode with simulated progress (track interval for cleanup)
    this.ngZone.runOutsideAngular(() => {
      const progressInterval = setInterval(() => {
        this.ngZone.run(() => {
          this.calculationProgress += Math.random() * 15 + 5;
          if (this.calculationProgress >= 100) {
            this.calculationProgress = 100;
            clearInterval(progressInterval);
            this.activeIntervals = this.activeIntervals.filter(i => i !== progressInterval);

            // Generate mock random values
            this.box2Federal = Math.floor(Math.random() * 1500) + 500;
            this.box17State = Math.floor(Math.random() * 500) + 200;
            this.estimatedRefund = this.box2Federal + this.box17State;
            this.ocrConfidence = 'high';

            setTimeout(() => {
              this.showResult();
            }, 600);
          }
        });
      }, 400);
      this.activeIntervals.push(progressInterval);
    });
  }

  showResult() {
    this.state = 'result';

    // Celebrate the result with money rain!
    setTimeout(() => this.confettiService.moneyRain(), 300);

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

    this.isSavingDocument = true;

    this.documentService.upload(this.uploadedFile, DocumentType.W2).subscribe({
      next: () => {
        this.isSavingDocument = false;
        this.documentSaved = true;

        // Trigger dashboard refresh so "Tu Progreso" updates to show W2 uploaded (+25%)
        this.dataRefreshService.refreshDashboard();

        this.cdr.detectChanges();
      },
      error: () => {
        this.isSavingDocument = false;
        // Don't show error to user - they can still use calculator results
        // They can manually upload later in documents section
        this.cdr.detectChanges();
      }
    });
  }

  resetCalculator() {
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

  /**
   * Cancel ongoing calculation and return to upload state
   */
  cancelCalculation() {
    // Cancel API subscription
    if (this.apiSubscription) {
      this.apiSubscription.unsubscribe();
      this.apiSubscription = null;
    }
    // Clear all intervals
    this.clearAllIntervals();
    // Reset state
    this.resetCalculator();
    this.cdr.detectChanges();
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
    this.state = 'calculating';
    this.calculationProgress = 0;
    this.errorMessage = '';
    this.runMockCalculation();
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

