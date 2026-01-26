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
} from '../../core/services/jai1gent.service';
import { ToastService } from '../../core/services/toast.service';

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

  // ============= NAVIGATION =============

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }
}
