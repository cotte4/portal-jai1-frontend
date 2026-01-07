import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileResponse, Address } from '../../core/models';
import { timeout, catchError, filter, retry, delay, take } from 'rxjs/operators';
import { of, Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private dataRefreshService = inject(DataRefreshService);
  private toastService = inject(ToastService);
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

  ngOnInit() {
    // Wait for auth to be ready before loading profile
    // On page refresh, currentUser might be null initially
    this.subscriptions.add(
      this.authService.currentUser$.pipe(
        filter(user => user !== null),
        take(1)
      ).subscribe(() => {
        this.loadProfile();
      })
    );

    // Fallback: if no user after 500ms, try loading anyway (might redirect to login)
    this.subscriptions.add(
      timer(500).subscribe(() => {
        if (this.isLoading && !this.authService.currentUser) {
          console.log('Profile: Auth timeout, attempting load anyway');
          this.loadProfile();
        }
      })
    );

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

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
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
      // No user in auth service - try to load from cached profile
      const cachedProfile = localStorage.getItem('jai1_cached_profile');
      if (cachedProfile) {
        try {
          const cached = JSON.parse(cachedProfile);
          this.userName = cached.userName || 'Usuario';
          this.userEmail = cached.userEmail || '';
          this.userPhone = cached.userPhone || '';
        } catch {
          this.userName = 'Usuario';
        }
      } else {
        this.userName = 'Usuario';
        this.userEmail = '';
      }
    }

    // Load profile picture from localStorage (user-specific)
    const userId = this.authService.currentUser?.id;
    if (userId) {
      const savedPicture = localStorage.getItem(`profilePicture_${userId}`);
      if (savedPicture) {
        this.profilePicture = savedPicture;
      }
    }

    // Try to fetch profile data with retry logic
    this.profileService.getProfile().pipe(
      timeout(8000), // 8 second timeout
      retry({ count: 2, delay: 1000 }), // Retry up to 2 times with 1s delay
      catchError((error) => {
        console.error('Profile: Failed to load after retries', error);
        // Show toast only if it's not a 401 (auth redirect will handle that)
        if (error?.status !== 401) {
          this.toastService.error('Error al cargar el perfil. Intenta recargar la página.');
        }
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

          // Cache profile data for faster loads on refresh
          this.cacheProfileData();
        }

        // Update from API response user data if available
        if (response?.user) {
          this.userName = `${response.user.firstName || ''} ${response.user.lastName || ''}`.trim() || 'Usuario';
          this.userEmail = response.user.email || this.userEmail;
          this.userPhone = response.user.phone || '';

          // Update edit form with fresh data
          this.editForm.firstName = response.user.firstName || '';
          this.editForm.lastName = response.user.lastName || '';
          this.editForm.phone = response.user.phone || '';

          // Cache for next refresh
          this.cacheProfileData();
        }

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    // Safety timeout - stop loading after 10 seconds no matter what
    setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        console.log('Profile: Safety timeout triggered');
      }
    }, 10000);
  }

  private cacheProfileData(): void {
    const cacheData = {
      userName: this.userName,
      userEmail: this.userEmail,
      userPhone: this.userPhone,
      cachedAt: Date.now()
    };
    localStorage.setItem('jai1_cached_profile', JSON.stringify(cacheData));
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
        this.toastService.error('Por favor selecciona una imagen válida');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.toastService.error('La imagen no puede superar los 5MB');
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
        this.toastService.success('¡Foto de perfil actualizada!');
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
    this.toastService.success('Foto de perfil eliminada');
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    this.errorMessage = '';
    this.successMessage = '';
  }

  saveChanges() {
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
        this.userName = `${response.user.firstName} ${response.user.lastName}`.trim();
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
          currentUser.firstName = response.user.firstName;
          currentUser.lastName = response.user.lastName;
          currentUser.phone = response.user.phone;
        }

        this.isSaving = false;
        this.isEditing = false;
        this.toastService.success('¡Cambios guardados correctamente!');
      },
      error: (error) => {
        this.isSaving = false;
        this.toastService.error(error?.error?.message || 'Error al guardar los cambios');
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
