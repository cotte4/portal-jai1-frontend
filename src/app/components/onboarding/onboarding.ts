import { Component, inject, NgZone, OnInit, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';
import { DocumentService } from '../../core/services/document.service';
import { CalculatorResultService } from '../../core/services/calculator-result.service';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective, CardAnimateDirective } from '../../shared/directives';
import { DocumentType } from '../../core/models';
import { gsap } from 'gsap';

type OnboardingStep = 'welcome' | 'benefits' | 'documents' | 'calculator' | 'warning';

interface Benefit {
  headline: string;
  subtext: string;
  icon: string;
}

@Component({
  selector: 'app-onboarding',
  imports: [CommonModule, HoverScaleDirective, CardAnimateDirective],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css'
})
export class Onboarding implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private authService = inject(AuthService);
  private storage = inject(StorageService);
  private documentService = inject(DocumentService);
  private calculatorResultService = inject(CalculatorResultService);
  private animationService = inject(AnimationService);
  private elementRef = inject(ElementRef);

  // State
  currentStep: OnboardingStep = 'welcome';
  currentBenefitIndex = 0;
  userName = '';
  private previousStep: OnboardingStep | null = null;

  // Calculator state
  uploadedFile: File | null = null;
  isDragging = false;
  calculatorState: 'upload' | 'calculating' | 'result' = 'upload';
  calculationProgress = 0;
  estimatedRefund = 0;
  private displayedRefund = 0;

  // Benefits content
  benefits: Benefit[] = [
    {
      headline: 'Todo tu proceso de taxes, en un solo lugar',
      subtext: 'Olvidate de WhatsApp, emails y formularios dispersos. Carga tus datos, subi tus documentos y segui tu reembolso desde una sola plataforma.',
      icon: 'dashboard'
    },
    {
      headline: 'Segui el estado de tus taxes en tiempo real',
      subtext: 'Sabe exactamente en que etapa esta tu declaracion. Sin llamadas, sin esperas, todo visible desde tu panel.',
      icon: 'tracking'
    },
    {
      headline: 'Soporte cuando lo necesites',
      subtext: 'Chatbot inteligente para consultas rapidas y sistema de tickets para resolver cualquier duda o problema especifico.',
      icon: 'support'
    }
  ];

  ngOnInit() {
    const user = this.authService.currentUser;
    if (user) {
      this.userName = user.firstName || user.email.split('@')[0];
    }
  }

  ngAfterViewInit() {
    // Animate decorations
    this.animateDecorations();

    // Initial entrance animation
    setTimeout(() => {
      this.animateStepEntrance();
    }, 100);
  }

  ngOnDestroy() {
    this.animationService.killAnimations();
  }

  private animateDecorations() {
    const decorations = this.elementRef.nativeElement.querySelectorAll('.decoration');
    decorations.forEach((dec: HTMLElement, index: number) => {
      this.animationService.float(dec, {
        distance: 15 + (index * 5),
        duration: 6 + (index * 2)
      });
    });
  }

  private animateStepEntrance() {
    const container = this.elementRef.nativeElement;

    // Animate logo
    const logo = container.querySelector('.logo-container');
    if (logo) {
      this.animationService.scaleIn(logo, { duration: 0.5, fromScale: 0.8 });
    }

    // Animate current card
    this.animateCurrentCard();
  }

  private animateCurrentCard() {
    const container = this.elementRef.nativeElement;
    let cardSelector = '';

    switch (this.currentStep) {
      case 'welcome': cardSelector = '.welcome-card'; break;
      case 'benefits': cardSelector = '.benefits-card'; break;
      case 'documents': cardSelector = '.documents-card'; break;
      case 'calculator': cardSelector = '.calculator-card'; break;
      case 'warning': cardSelector = '.warning-card'; break;
    }

    const card = container.querySelector(cardSelector);
    if (card) {
      this.animationService.slideIn(card as HTMLElement, 'up', { duration: 0.5, distance: 30 });

      // Stagger animate children
      setTimeout(() => {
        this.animateCardChildren(cardSelector);
      }, 200);
    }
  }

  private animateCardChildren(cardSelector: string) {
    const container = this.elementRef.nativeElement;

    if (cardSelector === '.welcome-card') {
      const elements = container.querySelectorAll('.welcome-card .welcome-title, .welcome-card .welcome-subtitle, .welcome-card .btn-primary');
      if (elements.length) {
        this.animationService.staggerIn(elements, { stagger: 0.1, direction: 'up', distance: 20 });
      }
    } else if (cardSelector === '.benefits-card') {
      this.animateBenefitsCard();
    } else if (cardSelector === '.documents-card') {
      this.animateDocumentsCard();
    } else if (cardSelector === '.calculator-card') {
      this.animateCalculatorCard();
    } else if (cardSelector === '.warning-card') {
      this.animateWarningCard();
    }
  }

  private animateBenefitsCard() {
    const container = this.elementRef.nativeElement;
    const elements = container.querySelectorAll('.benefit-icon-container, .benefit-headline, .benefit-subtext, .progress-dots, .benefits-actions');
    if (elements.length) {
      this.animationService.staggerIn(elements, { stagger: 0.08, direction: 'up', distance: 20 });
    }

    // Animate progress dots
    this.animateProgressDots();
  }

  private animateProgressDots() {
    const container = this.elementRef.nativeElement;
    const dots = container.querySelectorAll('.dot');
    if (dots.length) {
      gsap.fromTo(dots,
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.3,
          stagger: 0.1,
          ease: 'back.out(1.7)',
          delay: 0.3
        }
      );
    }
  }

  private animateDocumentsCard() {
    const container = this.elementRef.nativeElement;
    const header = container.querySelectorAll('.documents-header');
    const checklistItems = container.querySelectorAll('.checklist-item');
    const actions = container.querySelectorAll('.documents-actions button');

    if (header.length) {
      this.animationService.slideIn(header[0] as HTMLElement, 'up', { duration: 0.4, distance: 20 });
    }

    if (checklistItems.length) {
      this.animationService.staggerIn(checklistItems, { stagger: 0.12, direction: 'left', distance: 30, delay: 0.2 });

      // Animate checkmarks with success animation
      setTimeout(() => {
        checklistItems.forEach((item: Element, index: number) => {
          const checkCircle = item.querySelector('.check-circle');
          if (checkCircle) {
            setTimeout(() => {
              this.animationService.successCheck(checkCircle as HTMLElement);
            }, index * 150);
          }
        });
      }, 600);
    }

    if (actions.length) {
      this.animationService.staggerIn(actions, { stagger: 0.1, direction: 'up', distance: 20, delay: 0.6 });
    }
  }

  private animateCalculatorCard() {
    const container = this.elementRef.nativeElement;

    if (this.calculatorState === 'upload') {
      const header = container.querySelector('.calculator-header');
      const uploadZone = container.querySelector('.upload-zone');

      if (header) {
        this.animationService.slideIn(header as HTMLElement, 'up', { duration: 0.4 });
      }
      if (uploadZone) {
        this.animationService.scaleIn(uploadZone as HTMLElement, { delay: 0.2, fromScale: 0.95 });
      }
    }
  }

  private animateWarningCard() {
    const container = this.elementRef.nativeElement;
    const icon = container.querySelector('.warning-icon-container');
    const elements = container.querySelectorAll('.warning-title, .warning-text, .warning-box, .btn-secondary');

    if (icon) {
      // Shake animation for warning icon
      gsap.fromTo(icon,
        { scale: 0, rotation: -10 },
        {
          scale: 1,
          rotation: 0,
          duration: 0.5,
          ease: 'back.out(1.7)'
        }
      );
    }

    if (elements.length) {
      this.animationService.staggerIn(elements, { stagger: 0.1, direction: 'up', distance: 20, delay: 0.3 });
    }
  }

  private animateStepTransition(direction: 'forward' | 'backward' = 'forward') {
    const container = this.elementRef.nativeElement;
    const currentCard = container.querySelector('.welcome-card, .benefits-card, .documents-card, .calculator-card, .warning-card');

    if (currentCard) {
      const slideDirection = direction === 'forward' ? 'left' : 'right';
      this.animationService.slideOut(currentCard as HTMLElement, slideDirection, {
        duration: 0.3,
        distance: 50,
        onComplete: () => {
          // Animation handled by Angular's change detection
        }
      });
    }
  }

  // Navigation
  nextStep() {
    this.animateStepTransition('forward');

    setTimeout(() => {
      this.previousStep = this.currentStep;

      switch (this.currentStep) {
        case 'welcome':
          this.currentStep = 'benefits';
          break;
        case 'benefits':
          if (this.currentBenefitIndex < this.benefits.length - 1) {
            this.animateBenefitChange('next');
            this.currentBenefitIndex++;
            return; // Don't animate card, just content
          } else {
            this.currentStep = 'documents';
          }
          break;
      }

      setTimeout(() => this.animateCurrentCard(), 50);
    }, 300);
  }

  previousBenefit() {
    if (this.currentBenefitIndex > 0) {
      this.animateBenefitChange('prev');
      this.currentBenefitIndex--;
    }
  }

  private animateBenefitChange(direction: 'next' | 'prev') {
    const container = this.elementRef.nativeElement;
    const content = container.querySelectorAll('.benefit-icon-container, .benefit-headline, .benefit-subtext');

    if (content.length) {
      const slideDir = direction === 'next' ? 'left' : 'right';
      gsap.to(content, {
        opacity: 0,
        x: direction === 'next' ? -30 : 30,
        duration: 0.2,
        onComplete: () => {
          setTimeout(() => {
            gsap.fromTo(content,
              { opacity: 0, x: direction === 'next' ? 30 : -30 },
              { opacity: 1, x: 0, duration: 0.3, stagger: 0.05 }
            );
            this.animateProgressDotChange();
          }, 50);
        }
      });
    }
  }

  private animateProgressDotChange() {
    const container = this.elementRef.nativeElement;
    const activeDot = container.querySelector('.dot.active');

    if (activeDot) {
      gsap.fromTo(activeDot,
        { scale: 0.8 },
        { scale: 1, duration: 0.3, ease: 'back.out(1.7)' }
      );
    }
  }

  // Document check
  onHasDocuments() {
    this.animateStepTransition('forward');
    setTimeout(() => {
      this.currentStep = 'calculator';
      setTimeout(() => this.animateCurrentCard(), 50);
    }, 300);
  }

  onNoDocuments() {
    this.animateStepTransition('forward');
    setTimeout(() => {
      this.currentStep = 'warning';
      setTimeout(() => this.animateCurrentCard(), 50);
    }, 300);
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

    // Animate transition to calculating state
    setTimeout(() => {
      this.animateCalculatingState();
    }, 100);

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

  private animateCalculatingState() {
    const container = this.elementRef.nativeElement;
    const calcContainer = container.querySelector('.calculating-container');
    const spinner = container.querySelector('.spinner');
    const progressBar = container.querySelector('.progress-fill');

    if (calcContainer) {
      this.animationService.fadeIn(calcContainer as HTMLElement, { duration: 0.4 });
    }

    if (spinner) {
      gsap.fromTo(spinner,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }
      );
    }
  }

  showResult() {
    this.estimatedRefund = Math.floor(Math.random() * 1700) + 800;
    this.calculatorState = 'result';

    // Animate result appearance
    setTimeout(() => {
      this.animateResultState();
    }, 100);

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

  private animateResultState() {
    const container = this.elementRef.nativeElement;
    const resultContainer = container.querySelector('.result-container');
    const badge = container.querySelector('.result-badge');
    const amount = container.querySelector('.result-amount');
    const button = container.querySelector('.result-container .btn-primary');

    if (resultContainer) {
      this.animationService.scaleIn(resultContainer as HTMLElement, { duration: 0.5, fromScale: 0.9 });
    }

    if (badge) {
      setTimeout(() => {
        this.animationService.successCheck(badge as HTMLElement);
      }, 300);
    }

    // Counter animation for the refund amount
    if (amount) {
      this.displayedRefund = 0;
      this.animationService.counterUp(amount as HTMLElement, this.estimatedRefund, {
        startValue: 0,
        duration: 1.5,
        prefix: '$',
        decimals: 0
      });
    }

    if (button) {
      setTimeout(() => {
        this.animationService.slideIn(button as HTMLElement, 'up', { distance: 20 });
        this.animationService.pulse(button as HTMLElement, { scale: 1.05, repeat: 2 });
      }, 1200);
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
    if (this.calculationProgress < 60) return 'Extrayendo informacion...';
    if (this.calculationProgress < 90) return 'Calculando reembolso...';
    return 'Generando resultado...';
  }
}
