import { Component, inject, NgZone, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';
import { DocumentService } from '../../core/services/document.service';
import { CalculatorResultService } from '../../core/services/calculator-result.service';
import { CalculatorApiService } from '../../core/services/calculator-api.service';
import { DocumentType } from '../../core/models';

type OnboardingStep = 'welcome' | 'benefits' | 'documents' | 'calculator' | 'warning';

interface Benefit {
  headline: string;
  subtext: string;
  icon: string;
}

@Component({
  selector: 'app-onboarding',
  imports: [CommonModule],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css'
})
export class Onboarding implements OnInit, OnDestroy {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private authService = inject(AuthService);
  private storage = inject(StorageService);
  private documentService = inject(DocumentService);
  private calculatorResultService = inject(CalculatorResultService);
  private calculatorApiService = inject(CalculatorApiService);
  private cdr = inject(ChangeDetectorRef);

  // Cleanup tracking
  private progressIntervalId: ReturnType<typeof setInterval> | null = null;
  private resultTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private uploadSubscription: Subscription | null = null;
  private apiSubscription: Subscription | null = null;

  // State
  currentStep: OnboardingStep = 'welcome';
  currentBenefitIndex = 0;
  userName = '';

  // Calculator state
  uploadedFile: File | null = null;
  isDragging = false;
  calculatorState: 'upload' | 'calculating' | 'result' | 'error' = 'upload';
  calculationProgress = 0;
  estimatedRefund = 0;
  errorMessage = '';

  // Benefits content
  benefits: Benefit[] = [
    {
      headline: 'Todo tu proceso de taxes, en un solo lugar',
      subtext: 'Olvidate de WhatsApp, emails y formularios dispersos. Cargá tus datos, subí tus documentos y seguí tu reembolso desde una sola plataforma.',
      icon: 'dashboard'
    },
    {
      headline: 'Seguí el estado de tus taxes en tiempo real',
      subtext: 'Sabé exactamente en qué etapa está tu declaración. Sin llamadas, sin esperas, todo visible desde tu panel.',
      icon: 'tracking'
    },
    {
      headline: 'Soporte cuando lo necesites',
      subtext: 'Chatbot inteligente para consultas rápidas y sistema de tickets para resolver cualquier duda o problema específico.',
      icon: 'support'
    }
  ];

  ngOnInit() {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.firstName || user.email.split('@')[0];
    }
  }

  ngOnDestroy() {
    if (this.progressIntervalId) {
      clearInterval(this.progressIntervalId);
    }
    if (this.resultTimeoutId) {
      clearTimeout(this.resultTimeoutId);
    }
    if (this.uploadSubscription) {
      this.uploadSubscription.unsubscribe();
    }
    if (this.apiSubscription) {
      this.apiSubscription.unsubscribe();
    }
  }

  // Navigation
  nextStep() {
    switch (this.currentStep) {
      case 'welcome':
        this.currentStep = 'benefits';
        break;
      case 'benefits':
        if (this.currentBenefitIndex < this.benefits.length - 1) {
          this.currentBenefitIndex++;
        } else {
          this.currentStep = 'documents';
        }
        break;
    }
  }

  previousBenefit() {
    if (this.currentBenefitIndex > 0) {
      this.currentBenefitIndex--;
    }
  }

  // Document check
  onHasDocuments() {
    this.currentStep = 'calculator';
  }

  onNoDocuments() {
    this.currentStep = 'warning';
  }

  // Warning actions
  exploreApp() {
    this.storage.setOnboardingCompleted();
    this.router.navigate(['/dashboard']);
  }

  // Calculator methods
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
    // Only accept JPG/PNG for OCR analysis
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('Solo archivos JPG y PNG son compatibles. Por favor convierte tu W2 a uno de estos formatos.');
      return;
    }

    this.uploadedFile = file;
    this.errorMessage = '';
    this.startCalculation();
  }

  startCalculation() {
    if (!this.uploadedFile) return;

    this.calculatorState = 'calculating';
    this.calculationProgress = 0;
    this.errorMessage = '';

    // Start progress animation
    this.ngZone.runOutsideAngular(() => {
      this.progressIntervalId = setInterval(() => {
        this.ngZone.run(() => {
          if (this.calculationProgress < 90) {
            this.calculationProgress += Math.random() * 10 + 3;
            this.cdr.detectChanges();
          }
        });
      }, 500);
    });

    // Call real OCR API
    this.apiSubscription = this.calculatorApiService.estimateRefund(this.uploadedFile).subscribe({
      next: (response) => {
        if (this.progressIntervalId) {
          clearInterval(this.progressIntervalId);
          this.progressIntervalId = null;
        }
        this.calculationProgress = 100;
        this.estimatedRefund = response.estimatedRefund;

        this.resultTimeoutId = setTimeout(() => {
          this.showResult();
        }, 600);
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (this.progressIntervalId) {
          clearInterval(this.progressIntervalId);
          this.progressIntervalId = null;
        }
        console.error('Calculator API error:', error);
        this.errorMessage = 'Error al analizar el documento. Intenta con otra imagen.';
        this.calculatorState = 'error';
        this.cdr.detectChanges();
      }
    });
  }

  retryCalculation() {
    this.calculatorState = 'upload';
    this.uploadedFile = null;
    this.errorMessage = '';
  }

  showResult() {
    this.calculatorState = 'result';

    // Save result to localStorage and backend
    this.calculatorResultService.saveResult(
      this.estimatedRefund,
      this.uploadedFile?.name
    );

    // Save W2 document
    if (this.uploadedFile) {
      this.uploadSubscription = this.documentService.upload(this.uploadedFile, DocumentType.W2).subscribe({
        next: () => console.log('W2 saved successfully'),
        error: (err) => console.error('Error saving W2:', err)
      });
    }
  }

  goToDashboard() {
    this.storage.setOnboardingCompleted();
    this.router.navigate(['/dashboard']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  get currentBenefit(): Benefit {
    return this.benefits[this.currentBenefitIndex];
  }

  get progressText(): string {
    if (this.calculationProgress < 30) return 'Analizando documento...';
    if (this.calculationProgress < 60) return 'Extrayendo información...';
    if (this.calculationProgress < 90) return 'Calculando reembolso...';
    return 'Generando resultado...';
  }
}
