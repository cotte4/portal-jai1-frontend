import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DocumentService } from '../../core/services/document.service';
import { CalculatorResultService, CalculatorResult } from '../../core/services/calculator-result.service';
import { ProfileResponse, ClientStatus, Document, DocumentType, TaxStatus } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private documentService = inject(DocumentService);
  private calculatorResultService = inject(CalculatorResultService);

  profileData: ProfileResponse | null = null;
  documents: Document[] = [];
  calculatorResult: CalculatorResult | null = null;
  isLoading: boolean = true;
  errorMessage: string = '';

  ngOnInit() {
    this.loadData();
    this.calculatorResultService.result$.subscribe(result => {
      this.calculatorResult = result;
    });
  }

  loadData() {
    this.isLoading = true;
    
    // Load profile
    this.profileService.getProfile().subscribe({
      next: (data) => {
        this.profileData = data;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al cargar perfil';
        this.isLoading = false;
      }
    });

    // Load documents
    this.documentService.getDocuments().subscribe({
      next: (docs) => {
        this.documents = docs;
      },
      error: () => {
        // Silent fail for documents
      }
    });
  }

  // ============ CALCULATOR RESULT ============
  get hasCalculatorResult(): boolean {
    return this.calculatorResult !== null;
  }

  get estimatedRefundDisplay(): string {
    if (this.calculatorResult) {
      return `$${this.calculatorResult.estimatedRefund.toLocaleString()}`;
    }
    return '--';
  }

  // ============ USER PROGRESS ============
  get isProfileComplete(): boolean {
    return this.profileData?.profile?.profileComplete || false;
  }

  get isFormSent(): boolean {
    // Form is sent if profile is complete and not a draft
    return this.profileData?.profile?.profileComplete === true && 
           this.profileData?.profile?.isDraft === false;
  }

  get hasW2Document(): boolean {
    return this.documents.some(d => d.type === DocumentType.W2);
  }

  get hasPaymentProof(): boolean {
    return this.documents.some(d => d.type === DocumentType.PAYMENT_PROOF);
  }

  get userProgressPercent(): number {
    let completed = 0;
    if (this.isProfileComplete) completed++;
    if (this.isFormSent) completed++;
    if (this.hasW2Document) completed++;
    if (this.hasPaymentProof) completed++;
    return Math.round((completed / 4) * 100);
  }

  get userProgressComplete(): boolean {
    return this.userProgressPercent === 100;
  }

  // ============ IRS PROGRESS ============
  get taxCase() {
    return this.profileData?.taxCase;
  }

  get isSentToIRS(): boolean {
    if (!this.taxCase) return false;
    const sentStatuses = [
      ClientStatus.TAXES_EN_PROCESO,
      ClientStatus.TAXES_EN_CAMINO,
      ClientStatus.EN_VERIFICACION,
      ClientStatus.TAXES_DEPOSITADOS,
      ClientStatus.TAXES_FINALIZADOS
    ];
    return sentStatuses.includes(this.taxCase.clientStatus);
  }

  get isAcceptedByIRS(): boolean {
    if (!this.taxCase) return false;
    return this.taxCase.federalStatus === TaxStatus.APPROVED ||
           this.taxCase.federalStatus === TaxStatus.DEPOSITED;
  }

  get estimatedReturnDate(): string | null {
    if (!this.taxCase?.refundDepositDate) return null;
    return new Date(this.taxCase.refundDepositDate).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  get isRefundDeposited(): boolean {
    if (!this.taxCase) return false;
    return this.taxCase.clientStatus === ClientStatus.TAXES_DEPOSITADOS ||
           this.taxCase.clientStatus === ClientStatus.TAXES_FINALIZADOS;
  }

  get irsProgressPercent(): number {
    let completed = 0;
    if (this.isSentToIRS) completed++;
    if (this.isAcceptedByIRS) completed++;
    if (this.estimatedReturnDate) completed++;
    if (this.isRefundDeposited) completed++;
    return Math.round((completed / 4) * 100);
  }

  get showIRSProgress(): boolean {
    // Only show IRS progress if user has completed their part
    return this.userProgressComplete || this.isSentToIRS;
  }

  // ============ NAVIGATION ============
  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
