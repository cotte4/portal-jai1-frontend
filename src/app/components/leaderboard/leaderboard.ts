import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReferralService, LeaderboardEntry } from '../../core/services/referral.service';
import { AuthService } from '../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.html',
  styleUrls: ['./leaderboard.css']
})
export class Leaderboard implements OnInit, OnDestroy {
  private router = inject(Router);
  private referralService = inject(ReferralService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  // Contest end date
  readonly contestEndDate = '15 de Abril';

  // Data
  leaderboard: LeaderboardEntry[] = [];
  top3: LeaderboardEntry[] = [];
  rest: LeaderboardEntry[] = [];

  // States
  hasLoaded = false;
  errorMessage = '';
  private isLoadingInProgress = false;

  // Current user
  currentUserId = '';

  ngOnInit() {
    this.currentUserId = this.authService.currentUser?.id || '';
    this.loadLeaderboard();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLeaderboard() {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;
    this.errorMessage = '';

    this.referralService.getLeaderboard(10)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.hasLoaded = true;
          this.isLoadingInProgress = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data) => {
          this.leaderboard = data;
          this.top3 = data.slice(0, 3);
          this.rest = data.slice(3, 10);
        },
        error: (err) => {
          console.error('Failed to load leaderboard:', err);
          this.errorMessage = 'No se pudo cargar el leaderboard.';
        }
      });
  }

  // Podium order: [2nd, 1st, 3rd] for visual display
  get podiumEntries(): (LeaderboardEntry | null)[] {
    return [
      this.top3[1] || null,  // 2nd place - left
      this.top3[0] || null,  // 1st place - center (highest)
      this.top3[2] || null   // 3rd place - right
    ];
  }

  isCurrentUser(entry: LeaderboardEntry): boolean {
    return entry.userId === this.currentUserId;
  }

  getInitial(name: string): string {
    return name?.charAt(0)?.toUpperCase() || '?';
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  }

  goBack() {
    this.router.navigate(['/referral-program']);
  }

  goToTaxMode() {
    this.router.navigate(['/dashboard']);
  }
}
