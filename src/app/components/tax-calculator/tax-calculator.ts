import { Component, inject, NgZone, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../../core/services/document.service';
import { W2SharedService } from '../../core/services/w2-shared.service';
import { CalculatorResultService } from '../../core/services/calculator-result.service';
import { CalculatorApiService } from '../../core/services/calculator-api.service';
import { DocumentType, OcrConfidence } from '../../core/models';

type CalculatorState = 'upload' | 'calculating' | 'result';

@Component({
  selector: 'app-tax-calculator',
  imports: [CommonModule],
  templateUrl: './tax-calculator.html',
  styleUrl: './tax-calculator.css'
})
export class TaxCalculator implements OnInit {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private documentService = inject(DocumentService);
  private w2SharedService = inject(W2SharedService);
  private calculatorResultService = inject(CalculatorResultService);
  private calculatorApiService = inject(CalculatorApiService);
  private cdr = inject(ChangeDetectorRef);

  state: CalculatorState = 'upload';
  uploadedFile: File | null = null;
  isDragging = false;
  estimatedRefund = 0;
  calculationProgress = 0;

  // Result breakdown
  box2Federal = 0;
  box17State = 0;
  ocrConfidence: OcrConfidence = 'high';
  errorMessage = '';

  // Popup states
  showSavePopup = false;
  isSavingDocument = false;
  documentSaved = false;
  isFromDocuments = false;

  ngOnInit() {
    // Check if coming from documents with a W2 already uploaded
    this.w2SharedService.w2Uploaded$.subscribe(event => {
      if (event && event.source === 'documents') {
        this.isFromDocuments = true;
        this.documentSaved = true;
        // Start calculation automatically since doc is already saved
        this.startCalculation();
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
    // Accept PDF, images, and common document formats
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Por favor sube un archivo PDF o imagen de tu W2');
      return;
    }

    this.uploadedFile = file;
    this.startCalculation();
  }

  startCalculation() {
    this.state = 'calculating';
    this.calculationProgress = 0;
    this.errorMessage = '';

    // If no file (demo mode), use mock calculation
    if (!this.uploadedFile) {
      this.runMockCalculation();
      return;
    }

    // Start progress animation
    const progressInterval = setInterval(() => {
      if (this.calculationProgress < 90) {
        this.calculationProgress += Math.random() * 10 + 3;
        this.cdr.detectChanges();
      }
    }, 500);

    // Call real API
    this.calculatorApiService.estimateRefund(this.uploadedFile).subscribe({
      next: (response) => {
        clearInterval(progressInterval);
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
        console.error('Calculator API error:', error);
        this.errorMessage = error?.error?.message || 'Error al procesar el documento. Intenta nuevamente.';
        this.state = 'upload';
        this.cdr.detectChanges();
      }
    });
  }

  runMockCalculation() {
    // Demo mode with simulated progress
    this.ngZone.runOutsideAngular(() => {
      const progressInterval = setInterval(() => {
        this.ngZone.run(() => {
          this.calculationProgress += Math.random() * 15 + 5;
          if (this.calculationProgress >= 100) {
            this.calculationProgress = 100;
            clearInterval(progressInterval);

            // Generate mock values
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
    });
  }

  showResult() {
    this.state = 'result';

    // Save the calculator result
    this.calculatorResultService.saveResult(
      this.estimatedRefund,
      this.uploadedFile?.name
    );

    // If file was uploaded here (not from documents), show save popup
    if (this.uploadedFile && !this.isFromDocuments && !this.documentSaved) {
      setTimeout(() => {
        this.showSavePopup = true;
      }, 1500);
    }
    this.cdr.detectChanges();
  }

  resetCalculator() {
    this.state = 'upload';
    this.uploadedFile = null;
    this.estimatedRefund = 0;
    this.calculationProgress = 0;
    this.box2Federal = 0;
    this.box17State = 0;
    this.ocrConfidence = 'high';
    this.errorMessage = '';
    this.showSavePopup = false;
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
    this.isFromDocuments = true; // Demo doesn't need save popup
    this.startCalculation();
  }

  startProcess() {
    this.router.navigate(['/tax-form']);
  }

  // Save popup actions
  saveToDocuments() {
    if (!this.uploadedFile) return;

    this.isSavingDocument = true;
    this.documentService.upload(this.uploadedFile, DocumentType.W2).subscribe({
      next: () => {
        this.isSavingDocument = false;
        this.documentSaved = true;
        this.showSavePopup = false;
      },
      error: () => {
        this.isSavingDocument = false;
        alert('Error al guardar el documento. Intenta nuevamente.');
      }
    });
  }

  closeSavePopup() {
    this.showSavePopup = false;
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

