import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../../core/services/document.service';
import { W2SharedService } from '../../core/services/w2-shared.service';
import { CalculatorResultService } from '../../core/services/calculator-result.service';
import { DocumentType } from '../../core/models';

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

  state: CalculatorState = 'upload';
  uploadedFile: File | null = null;
  isDragging = false;
  estimatedRefund = 0;
  calculationProgress = 0;

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

    // Simulate calculation progress with proper Angular zone
    this.ngZone.runOutsideAngular(() => {
      const progressInterval = setInterval(() => {
        this.ngZone.run(() => {
          this.calculationProgress += Math.random() * 15 + 5;
          if (this.calculationProgress >= 100) {
            this.calculationProgress = 100;
            clearInterval(progressInterval);
            
            // Show result after a brief pause
            setTimeout(() => {
              this.showResult();
            }, 600);
          }
        });
      }, 400);
    });
  }

  showResult() {
    // Generate a realistic refund estimate between $800 and $2500
    this.estimatedRefund = Math.floor(Math.random() * 1700) + 800;
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
  }

  resetCalculator() {
    this.state = 'upload';
    this.uploadedFile = null;
    this.estimatedRefund = 0;
    this.calculationProgress = 0;
    this.showSavePopup = false;
    this.documentSaved = false;
    this.isFromDocuments = false;
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

