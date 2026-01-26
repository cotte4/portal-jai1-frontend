import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { Jai1gentService, Jai1gentDashboardResponse } from '../../core/services/jai1gent.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-jai1gent-dashboard',
  imports: [CommonModule],
  templateUrl: './jai1gent-dashboard.html',
  styleUrl: './jai1gent-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Jai1gentDashboard implements OnInit {
  private router = inject(Router);
  private jai1gentService = inject(Jai1gentService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  dashboard: Jai1gentDashboardResponse | null = null;
  isLoading = true;
  hasLoaded = false;
  errorMessage = '';
  copySuccess = false;

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.isLoading = true;
    this.errorMessage = '';

    this.jai1gentService.getDashboard()
      .pipe(finalize(() => {
        this.isLoading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.dashboard = data;
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Error al cargar el dashboard';
        },
      });
  }

  async copyReferralCode() {
    if (!this.dashboard?.referral_code) return;

    try {
      await navigator.clipboard.writeText(this.dashboard.referral_code);
      this.copySuccess = true;
      this.toast.success('Codigo copiado al portapapeles');
      this.cdr.detectChanges();

      setTimeout(() => {
        this.copySuccess = false;
        this.cdr.detectChanges();
      }, 2000);
    } catch {
      this.toast.error('Error al copiar el codigo');
    }
  }

  shareCode() {
    const message = this.jai1gentService.getShareMessage();
    if (!message) return;

    if (navigator.share) {
      navigator.share({
        title: 'JAI1 - Codigo de referido',
        text: message,
      }).catch(() => {
        // User cancelled or error - silent fail
      });
    } else {
      // Fallback: copy to clipboard
      this.copyReferralCode();
    }
  }

  getStatusLabel(status: string): string {
    return this.jai1gentService.getStatusLabel(status as any);
  }

  getStatusClass(status: string): string {
    return this.jai1gentService.getStatusColor(status as any);
  }

  goToProfile() {
    this.router.navigate(['/jai1gent/profile']);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.jai1gentService.clearCache();
        this.router.navigate(['/jai1gent/login']);
      },
      error: () => {
        // Still navigate on error
        this.jai1gentService.clearCache();
        this.router.navigate(['/jai1gent/login']);
      },
    });
  }
}
