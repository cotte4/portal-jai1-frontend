import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import {
  Jai1gentService,
  Jai1gentListItem,
  InviteCode,
  Jai1gentReferralDetail,
  Jai1gentReferralDetailResponse,
} from '../../core/services/jai1gent.service';
import { ToastService } from '../../core/services/toast.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-admin-jai1gents',
  imports: [FormsModule, CommonModule],
  templateUrl: './admin-jai1gents.html',
  styleUrl: './admin-jai1gents.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminJai1gents implements OnInit {
  private router = inject(Router);
  private jai1gentService = inject(Jai1gentService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);

  get darkMode() { return this.themeService.darkMode(); }

  // Tab state
  activeTab: 'jai1gents' | 'invite-codes' = 'jai1gents';

  // JAI1GENTS list
  jai1gents: Jai1gentListItem[] = [];
  jai1gentsTotal = 0;
  jai1gentsLoading = true;
  jai1gentsSearch = '';

  // Invite codes
  inviteCodes: InviteCode[] = [];
  inviteCodesTotal = 0;
  unusedCodesCount = 0;
  inviteCodesLoading = true;
  inviteCodesFilter: 'all' | 'used' | 'unused' = 'all';

  // Generate codes modal
  showGenerateModal = false;
  generateCount = 5;
  isGenerating = false;
  generatedCodes: string[] = [];

  // Create JAI1GENT modal
  showCreateModal = false;
  isCreating = false;
  createForm = {
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    referral_code: '',
  };

  // Edit referral code
  editingCodeFor: string | null = null; // user_id of jai1gent being edited
  editCodeValue = '';
  createErrorMessage = '';
  createdJai1gent: { email: string; name: string; referral_code: string } | null = null;

  // Referral detail modal
  showReferralModal = false;
  referralDetailLoading = false;
  referralDetailData: Jai1gentReferralDetailResponse | null = null;
  referralStatusFilter = 'all';

  ngOnInit() {
    this.loadJai1gents();
    this.loadInviteCodes();
  }

  // ============= TAB NAVIGATION =============

  setTab(tab: 'jai1gents' | 'invite-codes') {
    this.activeTab = tab;
  }

  // ============= JAI1GENTS =============

  loadJai1gents() {
    this.jai1gentsLoading = true;
    this.cdr.detectChanges();

    this.jai1gentService
      .listJai1gents({
        search: this.jai1gentsSearch || undefined,
        limit: 50,
      })
      .pipe(finalize(() => {
        this.jai1gentsLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.jai1gents = data.jai1gents;
          this.jai1gentsTotal = data.total;
        },
        error: () => {
          this.toast.error('Error al cargar JAI1GENTS');
        },
      });
  }

  onSearchJai1gents() {
    this.loadJai1gents();
  }

  // ============= INVITE CODES =============

  loadInviteCodes() {
    this.inviteCodesLoading = true;
    this.cdr.detectChanges();

    this.jai1gentService
      .listInviteCodes({
        status: this.inviteCodesFilter,
        limit: 100,
      })
      .pipe(finalize(() => {
        this.inviteCodesLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.inviteCodes = data.codes;
          this.inviteCodesTotal = data.total;
          this.unusedCodesCount = data.unused_count;
        },
        error: () => {
          this.toast.error('Error al cargar codigos de invitacion');
        },
      });
  }

  onFilterChange() {
    this.loadInviteCodes();
  }

  // ============= GENERATE CODES MODAL =============

  openGenerateModal() {
    this.showGenerateModal = true;
    this.generateCount = 5;
    this.generatedCodes = [];
  }

  closeGenerateModal() {
    this.showGenerateModal = false;
    if (this.generatedCodes.length > 0) {
      this.loadInviteCodes();
    }
  }

  generateCodes() {
    if (this.generateCount < 1 || this.generateCount > 100) {
      this.toast.error('Cantidad invalida (1-100)');
      return;
    }

    this.isGenerating = true;
    this.cdr.detectChanges();

    this.jai1gentService
      .generateInviteCodes(this.generateCount)
      .pipe(finalize(() => {
        this.isGenerating = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.generatedCodes = data.codes;
          this.toast.success(`${data.codes.length} codigos generados`);
        },
        error: () => {
          this.toast.error('Error al generar codigos');
        },
      });
  }

  copyAllCodes() {
    if (this.generatedCodes.length === 0) return;

    const text = this.generatedCodes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.toast.success('Codigos copiados al portapapeles');
    });
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      this.toast.success('Codigo copiado');
    });
  }

  // ============= TOGGLE ACTIVE =============

  toggleActive(jai1gent: Jai1gentListItem) {
    const newStatus = !jai1gent.is_active;
    const action = newStatus ? 'activar' : 'desactivar';

    if (!confirm(`Seguro que queres ${action} a ${jai1gent.name}?`)) {
      return;
    }

    this.jai1gentService
      .toggleActive(jai1gent.user_id, newStatus)
      .subscribe({
        next: (data) => {
          jai1gent.is_active = data.is_active;
          this.toast.success(data.message);
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.error(`Error al ${action} JAI1GENT`);
        },
      });
  }

  // ============= CREATE JAI1GENT MODAL =============

  openCreateModal() {
    this.showCreateModal = true;
    this.createErrorMessage = '';
    this.createdJai1gent = null;
    this.createForm = { email: '', password: '', first_name: '', last_name: '', phone: '', referral_code: '' };
  }

  closeCreateModal() {
    this.showCreateModal = false;
    if (this.createdJai1gent) {
      this.loadJai1gents();
    }
  }

  createJai1gent() {
    this.createErrorMessage = '';

    if (!this.createForm.email || !this.createForm.password || !this.createForm.first_name || !this.createForm.last_name || !this.createForm.referral_code) {
      this.createErrorMessage = 'Completa todos los campos requeridos';
      return;
    }

    if (this.createForm.password.length < 8) {
      this.createErrorMessage = 'La contraseña debe tener al menos 8 caracteres';
      return;
    }

    const code = this.createForm.referral_code.toUpperCase();
    if (!/^[A-Z0-9]{5,15}$/.test(code)) {
      this.createErrorMessage = 'El código debe tener 5-15 caracteres alfanuméricos';
      return;
    }

    this.isCreating = true;
    this.cdr.detectChanges();

    const data: any = {
      email: this.createForm.email,
      password: this.createForm.password,
      first_name: this.createForm.first_name,
      last_name: this.createForm.last_name,
      referral_code: code,
    };
    if (this.createForm.phone) {
      data.phone = this.createForm.phone;
    }

    this.jai1gentService
      .adminCreateJai1gent(data)
      .pipe(finalize(() => {
        this.isCreating = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (response) => {
          this.createdJai1gent = response.jai1gent;
          this.toast.success(response.message);
        },
        error: (err) => {
          const message = err.error?.message || err.message || '';
          if (message.includes('already registered')) {
            this.createErrorMessage = 'Este email ya esta registrado';
          } else if (message.includes('already in use')) {
            this.createErrorMessage = 'Este código de referido ya esta en uso';
          } else {
            this.createErrorMessage = message || 'Error al crear JAI1GENT';
          }
        },
      });
  }

  copyReferralCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      this.toast.success('Codigo de referido copiado');
    });
  }

  // ============= EDIT REFERRAL CODE =============

  startEditCode(jai1gent: Jai1gentListItem) {
    this.editingCodeFor = jai1gent.user_id;
    this.editCodeValue = jai1gent.referral_code;
    this.cdr.detectChanges();
  }

  cancelEditCode() {
    this.editingCodeFor = null;
    this.editCodeValue = '';
    this.cdr.detectChanges();
  }

  saveEditCode(jai1gent: Jai1gentListItem) {
    const code = this.editCodeValue.toUpperCase();
    if (!/^[A-Z0-9]{5,15}$/.test(code)) {
      this.toast.error('El código debe tener 5-15 caracteres alfanuméricos');
      return;
    }

    if (code === jai1gent.referral_code) {
      this.cancelEditCode();
      return;
    }

    this.jai1gentService
      .updateReferralCode(jai1gent.user_id, code)
      .subscribe({
        next: (data) => {
          jai1gent.referral_code = data.referral_code;
          this.editingCodeFor = null;
          this.editCodeValue = '';
          this.toast.success(data.message);
          this.cdr.detectChanges();
        },
        error: (err) => {
          const message = err.error?.message || '';
          if (message.includes('already in use')) {
            this.toast.error('Este código ya esta en uso');
          } else {
            this.toast.error('Error al actualizar código');
          }
        },
      });
  }

  onEditCodeKeydown(event: KeyboardEvent, jai1gent: Jai1gentListItem) {
    if (event.key === 'Enter') {
      this.saveEditCode(jai1gent);
    } else if (event.key === 'Escape') {
      this.cancelEditCode();
    }
  }

  // ============= REFERRAL DETAILS =============

  openReferralDetail(jai1gent: Jai1gentListItem) {
    this.showReferralModal = true;
    this.referralDetailData = null;
    this.referralStatusFilter = 'all';
    this.loadReferralDetail(jai1gent.user_id);
  }

  loadReferralDetail(userId: string) {
    this.referralDetailLoading = true;
    this.cdr.detectChanges();

    this.jai1gentService
      .getJai1gentReferrals(userId, {
        status: this.referralStatusFilter,
        limit: 100,
      })
      .pipe(finalize(() => {
        this.referralDetailLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.referralDetailData = data;
        },
        error: () => {
          this.toast.error('Error al cargar referidos');
        },
      });
  }

  onReferralFilterChange() {
    if (this.referralDetailData) {
      // Re-fetch with the jai1gent's userId — we can get it from the existing data
      // We need to find the userId. The response has jai1gent.email, match back to jai1gents list.
      const match = this.jai1gents.find(j => j.email === this.referralDetailData!.jai1gent.email);
      if (match) {
        this.loadReferralDetail(match.user_id);
      }
    }
  }

  closeReferralModal() {
    this.showReferralModal = false;
    this.referralDetailData = null;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      taxes_filed: 'Taxes presentados',
      completed: 'Completado',
      expired: 'Expirado',
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'status-pending',
      taxes_filed: 'status-filed',
      completed: 'status-completed',
      expired: 'status-expired',
    };
    return classes[status] || '';
  }

  // ============= NAVIGATION =============

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }
}
