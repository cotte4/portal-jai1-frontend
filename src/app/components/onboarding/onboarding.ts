import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';
import { DocumentService } from '../../core/services/document.service';
import { CalculatorResultService } from '../../core/services/calculator-result.service';
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
export class Onboarding implements OnInit {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private authService = inject(AuthService);
  private storage = inject(StorageService);
  private documentService = inject(DocumentService);
  private calculatorResultService = inject(CalculatorResultService);

  // State
  currentStep: OnboardingStep = 'welcome';
  currentBenefitIndex = 0;
  userName = '';

  // Calculator state
  uploadedFile: File | null = null;
  isDragging = false;
  calculatorState: 'upload' | 'calculating' | 'result' = 'upload';
  calculationProgress = 0;
  estimatedRefund = 0;

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
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Por favor sube un archivo PDF o imagen de tu W2');
      return;
    }

    this.uploadedFile = file;
    this.startCalculation();
  }

  startCalculation() {
    this.calculatorState = 'calculating';
    this.calculationProgress = 0;

    this.ngZone.runOutsideAngular(() => {
      const progressInterval = setInterval(() => {
        this.ngZone.run(() => {
          this.calculationProgress += Math.random() * 15 + 5;
          if (this.calculationProgress >= 100) {
            this.calculationProgress = 100;
            clearInterval(progressInterval);

            setTimeout(() => {
              this.showResult();
            }, 600);
          }
        });
      }, 400);
    });
  }

  showResult() {
    this.estimatedRefund = Math.floor(Math.random() * 1700) + 800;
    this.calculatorState = 'result';

    // Save result
    this.calculatorResultService.saveResult(
      this.estimatedRefund,
      this.uploadedFile?.name
    );

    // Save document to storage
    if (this.uploadedFile) {
      this.documentService.upload(this.uploadedFile, DocumentType.W2).subscribe({
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
