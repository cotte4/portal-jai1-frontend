import { Component, OnInit, OnDestroy, AfterViewInit, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective } from '../../shared/directives';
import { ProfileResponse, Address } from '../../core/models';
import { timeout, catchError, filter } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import { gsap } from 'gsap';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HoverScaleDirective],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private dataRefreshService = inject(DataRefreshService);
  private animationService = inject(AnimationService);
  private subscriptions = new Subscription();

  // User data
  userName: string = '';
  userEmail: string = '';
  userPhone: string = '';
  profilePicture: string | null = null;

  // Profile data
  dni: string = '';
  dateOfBirth: string = '';
  isVerified: boolean = false;
  memberSince: string = '';

  // Address
  address: Address = {
    street: '',
    city: '',
    state: '',
    zip: ''
  };

  // UI State
  isLoading: boolean = true;
  isEditing: boolean = false;
  isSaving: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  // Edit form data
  editForm = {
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    street: '',
    city: '',
    state: '',
    zip: ''
  };

  // Track if page has been animated
  private pageAnimated: boolean = false;

  ngOnInit() {
    this.loadProfile();

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects === '/profile')
      ).subscribe(() => this.loadProfile())
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/profile').subscribe(() => this.loadProfile())
    );
  }

  ngAfterViewInit() {
    // Animations will be triggered after loading completes
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
  }

  private animatePageEntrance() {
    if (this.pageAnimated) return;
    this.pageAnimated = true;

    // Animate member card
    const memberCard = document.querySelector('.member-card') as HTMLElement;
    if (memberCard) {
      this.animationService.scaleIn(memberCard, { duration: 0.5 });
    }

    // Stagger animate info sections
    const infoSections = document.querySelectorAll('.info-section');
    if (infoSections.length > 0) {
      this.animationService.staggerIn(infoSections, {
        direction: 'up',
        stagger: 0.1,
        delay: 0.3
      });
    }

    // Animate quick actions
    const quickActions = document.querySelectorAll('.action-btn');
    if (quickActions.length > 0) {
      this.animationService.staggerIn(quickActions, {
        direction: 'up',
        stagger: 0.08,
        delay: 0.5
      });
    }

    // Animate alerts if present
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach((alert, index) => {
      this.animationService.slideIn(alert as HTMLElement, 'right', { delay: 0.2 + index * 0.1 });
    });
  }

  animateSaveSuccess() {
    // Pulse animation on save button
    const saveBtn = document.querySelector('.btn-save') as HTMLElement;
    if (saveBtn) {
      this.animationService.pulse(saveBtn, { scale: 1.05, repeat: 2 });
    }

    // Animate success message
    const successAlert = document.querySelector('.alert.success') as HTMLElement;
    if (successAlert) {
      gsap.fromTo(successAlert,
        { opacity: 0, x: 50, scale: 0.95 },
        { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: 'back.out(1.2)' }
      );
    }
  }

  animateFormInputFocus(event: FocusEvent) {
    const input = event.target as HTMLElement;
    if (input && !this.animationService.prefersReducedMotion()) {
      gsap.to(input, {
        scale: 1.02,
        duration: 0.2,
        ease: 'power2.out'
      });
    }
  }

  animateFormInputBlur(event: FocusEvent) {
    const input = event.target as HTMLElement;
    if (input && !this.animationService.prefersReducedMotion()) {
      gsap.to(input, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out'
      });
    }
  }

  get userInitials(): string {
    if (this.userName) {
      const parts = this.userName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return this.userName.substring(0, 2).toUpperCase();
    }
    return this.userEmail ? this.userEmail.substring(0, 2).toUpperCase() : 'U';
  }

  loadProfile() {
    this.isLoading = true;

    // First, load user data from auth service (this is instant)
    const user = this.authService.currentUser;
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
      this.userEmail = user.email || 'usuario@ejemplo.com';
      this.userPhone = user.phone || '';
      this.memberSince = user.createdAt || '';

      // Initialize edit form
      this.editForm.firstName = user.firstName || '';
      this.editForm.lastName = user.lastName || '';
      this.editForm.phone = user.phone || '';
    } else {
      // Fallback to mock data if no user
      this.userName = 'Usuario Demo';
      this.userEmail = 'demo@jai1.com';
    }

    // Load profile picture from localStorage (user-specific)
    const userId = this.authService.currentUser?.id;
    if (userId) {
      const savedPicture = localStorage.getItem(`profilePicture_${userId}`);
      if (savedPicture) {
        this.profilePicture = savedPicture;
      }
    }

    // Try to fetch profile data with a timeout
    this.profileService.getProfile().pipe(
      timeout(5000), // 5 second timeout
      catchError(() => {
        // Return null on error, we'll use what we have
        return of(null);
      })
    ).subscribe({
      next: (response: ProfileResponse | null) => {
        if (response?.profile) {
          this.dni = response.profile.ssn || '';
          this.dateOfBirth = response.profile.dateOfBirth || '';
          this.isVerified = response.profile.profileComplete || false;

          // Initialize dateOfBirth in edit form (format for date input)
          if (response.profile.dateOfBirth) {
            const dob = new Date(response.profile.dateOfBirth);
            this.editForm.dateOfBirth = dob.toISOString().split('T')[0];
          }

          if (response.profile.address) {
            this.address = response.profile.address;
            this.editForm.street = response.profile.address.street || '';
            this.editForm.city = response.profile.address.city || '';
            this.editForm.state = response.profile.address.state || '';
            this.editForm.zip = response.profile.address.zip || '';
          }
        }
        // Always stop loading
        this.isLoading = false;

        // Trigger page animations after content loads
        setTimeout(() => this.animatePageEntrance(), 50);
      },
      error: () => {
        // Stop loading even on error
        this.isLoading = false;

        // Trigger page animations
        setTimeout(() => this.animatePageEntrance(), 50);
      }
    });

    // Safety timeout - stop loading after 3 seconds no matter what
    setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        setTimeout(() => this.animatePageEntrance(), 50);
      }
    }, 3000);
  }

  triggerFileInput() {
    const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Por favor selecciona una imagen válida';
        setTimeout(() => this.errorMessage = '', 3000);
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'La imagen no puede superar los 5MB';
        setTimeout(() => this.errorMessage = '', 3000);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        this.profilePicture = result;
        // Save to localStorage for persistence (user-specific)
        const userId = this.authService.currentUser?.id;
        if (userId) {
          localStorage.setItem(`profilePicture_${userId}`, result);
        }
        this.successMessage = '¡Foto de perfil actualizada!';
        setTimeout(() => this.successMessage = '', 3000);
      };
      reader.readAsDataURL(file);
    }
  }

  removeProfilePicture() {
    this.profilePicture = null;
    // Remove from localStorage (user-specific)
    const userId = this.authService.currentUser?.id;
    if (userId) {
      localStorage.removeItem(`profilePicture_${userId}`);
    }
    this.successMessage = 'Foto de perfil eliminada';
    setTimeout(() => this.successMessage = '', 3000);
  }

  toggleEdit() {
    // Block editing if profile is already verified (completed F2 form)
    if (this.isVerified) {
      return;
    }
    this.isEditing = !this.isEditing;
    this.errorMessage = '';
    this.successMessage = '';

    // Animate form entrance
    if (this.isEditing) {
      setTimeout(() => {
        const editForm = document.querySelector('.edit-form') as HTMLElement;
        if (editForm) {
          this.animationService.fadeIn(editForm, { duration: 0.3 });
        }
      }, 0);
    }
  }

  saveChanges() {
    // Block saving if profile is already verified (completed F2 form)
    if (this.isVerified) {
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';

    // Call the API to persist changes
    this.profileService.updateUserInfo({
      firstName: this.editForm.firstName,
      lastName: this.editForm.lastName,
      phone: this.editForm.phone,
      dateOfBirth: this.editForm.dateOfBirth || undefined,
      address: {
        street: this.editForm.street,
        city: this.editForm.city,
        state: this.editForm.state,
        zip: this.editForm.zip
      }
    }).subscribe({
      next: (response) => {
        // Update local state with response data
        this.userName = `${response.user.first_name} ${response.user.last_name}`.trim();
        this.userPhone = response.user.phone || '';

        if (response.address) {
          this.address = {
            street: response.address.street || '',
            city: response.address.city || '',
            state: response.address.state || '',
            zip: response.address.zip || ''
          };
        }

        if (response.dateOfBirth) {
          this.dateOfBirth = response.dateOfBirth;
        }

        // Update authService currentUser
        const currentUser = this.authService.currentUser;
        if (currentUser) {
          currentUser.firstName = response.user.first_name;
          currentUser.lastName = response.user.last_name;
          currentUser.phone = response.user.phone;
        }

        this.isSaving = false;
        this.isEditing = false;
        this.successMessage = '¡Cambios guardados correctamente!';

        // Trigger save success animation
        setTimeout(() => this.animateSaveSuccess(), 50);

        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage = error?.error?.message || 'Error al guardar los cambios';

        // Shake animation on error
        const saveBtn = document.querySelector('.btn-save') as HTMLElement;
        if (saveBtn) {
          this.animationService.validationShake(saveBtn);
        }

        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'No especificada';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return 'No especificada';
    }
  }

  formatMemberSince(): string {
    if (!this.memberSince) return 'Miembro desde 2024';
    try {
      const date = new Date(this.memberSince);
      return `Miembro desde ${date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    } catch {
      return 'Miembro desde 2024';
    }
  }

  maskDNI(dni: string): string {
    if (!dni || dni.length < 4) return 'No especificado';
    return '••••••' + dni.slice(-4);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
