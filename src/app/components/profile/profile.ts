import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileResponse, Address } from '../../core/models';
import { timeout, catchError, filter, retry, take } from 'rxjs/operators';
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
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();
  private safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // User data
  userName: string = '';
  userEmail: string = '';
  userPhone: string = '';
  profilePicture: string | null = null;
  pendingProfilePicture: string | null = null; // Staged picture preview during edit mode
  pendingProfilePictureFile: File | null = null; // File to upload to Supabase
  hasPendingPictureChange: boolean = false; // Track if user changed picture in edit mode
  pendingPictureRemoval: boolean = false; // Track if user wants to remove picture
  
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

  // Language preference
  preferredLanguage: string = 'es';
  availableLanguages = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' }
  ];
  isChangingLanguage: boolean = false;

  // UI State
  isLoading: boolean = true;
  hasLoadedOnce: boolean = false; // Track if we've ever loaded data
  profileDataLoaded: boolean = false; // Track if API profile data has loaded (for verification badge)
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
    // Load profile immediately if user is already authenticated
    // This handles normal navigation when auth is already established
    if (this.authService.currentUser) {
      this.loadProfile();
    } else {
      // Wait for auth to be ready before loading profile
      // On page refresh, currentUser might be null initially
      this.subscriptions.add(
        this.authService.currentUser$.pipe(
          filter(user => user !== null),
          take(1)
        ).subscribe(() => {
          if (!this.hasLoadedOnce) {
            this.loadProfile();
          }
        })
      );

      // Fallback: if still loading after 500ms, try loading anyway
      // This handles race conditions where currentUser$ already emitted before we subscribed
      this.subscriptions.add(
        timer(500).subscribe(() => {
          if (this.isLoading && !this.hasLoadedOnce) {
            console.log('Profile: Fallback timer triggered, loading profile');
            this.loadProfile();
          }
        })
      );
    }

    // Auto-refresh on navigation (for subsequent navigations to this route)
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
    // Clear safety timeout to prevent memory leaks and errors after component destroy
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
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

  get userAge(): number | null {
    if (!this.dateOfBirth) return null;
    try {
      const dob = new Date(this.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      // Adjust if birthday hasn't occurred yet this year
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      return age > 0 && age < 150 ? age : null; // Sanity check
    } catch {
      return null;
    }
  }

  loadProfile() {
    // Only show loading spinner on first load when we have no data yet
    // On subsequent loads (refresh), show existing data while fetching
    const hasCachedData = this.hasLoadedOnce || localStorage.getItem('jai1_cached_profile');
    this.isLoading = !hasCachedData;

    // Reset profile data loaded flag - we need fresh API data for verification status
    this.profileDataLoaded = false;

    // First, load user data from auth service (this is instant)
    const user = this.authService.currentUser;
    if (user) {
      this.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
      this.userEmail = user.email || 'usuario@ejemplo.com';
      this.userPhone = user.phone || '';
      this.memberSince = user.createdAt || '';

      // Load profile picture from auth state if available
      if (user.profilePictureUrl) {
        this.profilePicture = user.profilePictureUrl;
      }

      // Initialize edit form
      this.editForm.firstName = user.firstName || '';
      this.editForm.lastName = user.lastName || '';
      this.editForm.phone = user.phone || '';

      // Only show content immediately if we have complete cached data
      // Otherwise wait for API to load complete profile data
      if (hasCachedData) {
        this.hasLoadedOnce = true;
        this.isLoading = false;
      }
      // If no cache, keep isLoading = true until API completes
    } else {
      // No user in auth service - try to load from cached profile
      const cachedProfileData = localStorage.getItem('jai1_cached_profile');
      if (cachedProfileData) {
        try {
          const cached = JSON.parse(cachedProfileData);
          this.userName = cached.userName || 'Usuario';
          this.userEmail = cached.userEmail || '';
          this.userPhone = cached.userPhone || '';
          this.isVerified = cached.isVerified || false;
          // We have cached data, show it while API loads
          this.hasLoadedOnce = true;
          this.isLoading = false;
        } catch {
          this.userName = 'Usuario';
        }
      } else {
        this.userName = 'Usuario';
        this.userEmail = '';
      }
    }

    // Load cached profile data (address, verification status, etc.)
    // This also validates the cache belongs to the current user
    this.loadCachedProfileData();

    // Load profile picture from cache if available (with user ID validation)
    const cachedProfile = localStorage.getItem('jai1_cached_profile');
    if (cachedProfile) {
      try {
        const cached = JSON.parse(cachedProfile);
        const currentUser = this.authService.currentUser;
        // Only use cached picture if it belongs to the current user
        if (cached.profilePictureUrl && (!cached.userId || !currentUser?.id || cached.userId === currentUser.id)) {
          this.profilePicture = cached.profilePictureUrl;
        }
      } catch { /* ignore */ }
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
        // Handle both camelCase and snake_case from API
        if (response?.user) {
          const apiUser = response.user as any; // Backend may send extra fields
          const firstName = apiUser.firstName || apiUser.first_name || '';
          const lastName = apiUser.lastName || apiUser.last_name || '';
          this.userName = `${firstName} ${lastName}`.trim() || 'Usuario';
          this.userEmail = apiUser.email || this.userEmail;
          this.userPhone = apiUser.phone || '';

          // Load profile picture from API response (Supabase signed URL)
          const pictureUrl = apiUser.profilePictureUrl || apiUser.profile_picture_url;
          if (pictureUrl) {
            this.profilePicture = pictureUrl;
            // Update auth state so other components can access the picture
            this.authService.updateCurrentUser({
              profilePictureUrl: pictureUrl
            });
          }

          // Update edit form with fresh data
          this.editForm.firstName = firstName;
          this.editForm.lastName = lastName;
          this.editForm.phone = apiUser.phone || '';

          // Load language preference
          const language = apiUser.preferredLanguage || apiUser.preferred_language;
          if (language && ['es', 'en', 'pt'].includes(language)) {
            this.preferredLanguage = language;
          }

          // Cache for next refresh
          this.cacheProfileData();
        }

        this.hasLoadedOnce = true;
        this.profileDataLoaded = true; // API data received - can now show verification status
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // If we have any data to show, mark as loaded
        if (this.userName && this.userName !== 'Usuario') {
          this.hasLoadedOnce = true;
        }
        this.profileDataLoaded = true; // Even on error, mark as loaded to stop spinner
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });

    // Safety timeout - stop loading states after 8 seconds
    // Clear any existing timeout before setting a new one
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
    }
    this.safetyTimeoutId = setTimeout(() => {
      if (this.isLoading || !this.profileDataLoaded) {
        this.isLoading = false;
        this.profileDataLoaded = true; // Stop showing "Verificando..."
        if (this.userName || this.userEmail) {
          this.hasLoadedOnce = true;
        }
        console.log('Profile: Safety timeout triggered');
        this.cdr.detectChanges();
      }
      this.safetyTimeoutId = null;
    }, 8000);
  }

  private cacheProfileData(): void {
    const currentUser = this.authService.currentUser;
    const cacheData = {
      userId: currentUser?.id, // Include userId to prevent cross-user cache issues
      userName: this.userName,
      userEmail: this.userEmail,
      userPhone: this.userPhone,
      isVerified: this.isVerified,
      address: this.address,
      dateOfBirth: this.dateOfBirth,
      profilePictureUrl: this.profilePicture,
      cachedAt: Date.now()
    };
    localStorage.setItem('jai1_cached_profile', JSON.stringify(cacheData));
  }

  private invalidateDashboardCache(): void {
    // Remove dashboard cache so it fetches fresh data on next visit
    localStorage.removeItem('jai1_dashboard_cache');
  }

  private loadCachedProfileData(): void {
    const cachedProfile = localStorage.getItem('jai1_cached_profile');
    if (cachedProfile) {
      try {
        const cached = JSON.parse(cachedProfile);

        // Validate cache belongs to current user - prevent cross-user cache issues
        const currentUser = this.authService.currentUser;
        if (cached.userId && currentUser?.id && cached.userId !== currentUser.id) {
          localStorage.removeItem('jai1_cached_profile');
          return;
        }

        // Check cache age - expire after 1 hour (3600000ms)
        const cacheAge = Date.now() - (cached.cachedAt || 0);
        const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour
        if (cacheAge > CACHE_EXPIRY) {
          localStorage.removeItem('jai1_cached_profile');
          return;
        }

        if (cached.isVerified !== undefined) {
          this.isVerified = cached.isVerified;
        }
        if (cached.address) {
          this.address = cached.address;
          // Also sync editForm with cached address data
          this.editForm.street = cached.address.street || '';
          this.editForm.city = cached.address.city || '';
          this.editForm.state = cached.address.state || '';
          this.editForm.zip = cached.address.zip || '';
        }
        if (cached.dateOfBirth) {
          this.dateOfBirth = cached.dateOfBirth;
          // Format for date input
          try {
            const dob = new Date(cached.dateOfBirth);
            this.editForm.dateOfBirth = dob.toISOString().split('T')[0];
          } catch { /* ignore date parse errors */ }
        }
      } catch { /* ignore */ }
    }
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

      // Store file for upload to Supabase
      this.pendingProfilePictureFile = file;
      this.pendingPictureRemoval = false;

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Stage the picture preview - actual upload happens on save
        this.pendingProfilePicture = result;
        this.hasPendingPictureChange = true;
        this.cdr.detectChanges(); // Force Angular to update the view
        this.toastService.info('Foto seleccionada. Haz clic en "Guardar cambios" para confirmar.');
      };
      reader.readAsDataURL(file);
    }
  }

  removeProfilePicture() {
    if (this.isEditing) {
      // In edit mode - stage the removal, will be applied on save
      this.pendingProfilePicture = null;
      this.pendingProfilePictureFile = null;
      this.pendingPictureRemoval = true;
      this.hasPendingPictureChange = true;
      this.toastService.info('Foto marcada para eliminar. Haz clic en "Guardar cambios" para confirmar.');
    } else {
      // Not in edit mode - delete immediately via API
      this.subscriptions.add(
        this.profileService.deleteProfilePicture().subscribe({
          next: () => {
            this.profilePicture = null;
            // Update auth state to clear the picture
            this.authService.updateCurrentUser({
              profilePictureUrl: undefined
            });
            this.cacheProfileData();
            this.toastService.success('Foto de perfil eliminada');
          },
          error: (err) => {
            console.error('Failed to delete profile picture:', err);
            this.toastService.error('Error al eliminar la foto');
          }
        })
      );
    }
  }

  toggleEdit() {
    if (this.isEditing) {
      // Canceling edit mode - discard pending picture changes
      this.pendingProfilePicture = null;
      this.pendingProfilePictureFile = null;
      this.pendingPictureRemoval = false;
      this.hasPendingPictureChange = false;
    } else {
      // Entering edit mode - initialize pending picture with current
      this.pendingProfilePicture = this.profilePicture;
      this.pendingProfilePictureFile = null;
      this.pendingPictureRemoval = false;
      this.hasPendingPictureChange = false;
    }
    this.isEditing = !this.isEditing;
    this.errorMessage = '';
    this.successMessage = '';
  }

  saveChanges() {
    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const saveData = {
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
    };

    // Safety timeout - if no response after 10s, apply changes optimistically
    const safetyTimeout = setTimeout(() => {
      if (this.isSaving) {
        console.log('Safety timeout: applying changes optimistically');
        this.applyChangesLocally(saveData);
        this.toastService.success('¡Cambios guardados!');
        this.cdr.detectChanges(); // Trigger change detection after timeout
      }
    }, 10000);

    // Add subscription to tracked subscriptions so it survives navigation/refresh
    this.subscriptions.add(
      this.profileService.updateUserInfo(saveData).subscribe({
        next: (response) => {
          clearTimeout(safetyTimeout);

          // Update from response
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

          this.authService.updateCurrentUser({
            firstName: response.user.firstName,
            lastName: response.user.lastName,
            phone: response.user.phone
          });

          this.savePendingPicture();
          this.isSaving = false;
          this.isEditing = false;
          this.cacheProfileData();

          // Invalidate dashboard cache to ensure fresh data is loaded
          this.invalidateDashboardCache();
          // Trigger dashboard refresh so progress and user info updates
          this.dataRefreshService.refreshDashboard();

          this.toastService.success('¡Cambios guardados correctamente!');
          this.cdr.detectChanges();
        },
        error: (error) => {
          clearTimeout(safetyTimeout);
          console.error('Save error:', error);
          this.isSaving = false;
          this.toastService.error(error?.message || 'Error al guardar. Intenta de nuevo.');
          this.cdr.detectChanges();
        }
      })
    );
  }

  private applyChangesLocally(data: any) {
    // Apply changes locally (optimistic update)
    this.userName = `${data.firstName} ${data.lastName}`.trim();
    this.userPhone = data.phone || '';

    if (data.address) {
      this.address = {
        street: data.address.street || '',
        city: data.address.city || '',
        state: data.address.state || '',
        zip: data.address.zip || ''
      };
    }

    if (data.dateOfBirth) {
      this.dateOfBirth = data.dateOfBirth;
    }

    this.authService.updateCurrentUser({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone
    });

    this.savePendingPicture();
    this.isSaving = false;
    this.isEditing = false;

    // Also invalidate dashboard cache for optimistic updates
    this.invalidateDashboardCache();
    this.dataRefreshService.refreshDashboard();
  }

  private savePendingPicture() {
    if (!this.hasPendingPictureChange) {
      this.resetPendingPictureState();
      return;
    }

    // Handle picture removal
    if (this.pendingPictureRemoval) {
      this.subscriptions.add(
        this.profileService.deleteProfilePicture().subscribe({
          next: () => {
            this.profilePicture = null;
            // Update auth state to clear the picture
            this.authService.updateCurrentUser({
              profilePictureUrl: undefined
            });
            this.cacheProfileData();
            this.resetPendingPictureState();
            this.cdr.detectChanges(); // Force UI update
            this.toastService.success('Foto de perfil eliminada');
          },
          error: (err) => {
            console.error('Failed to delete profile picture:', err);
            this.toastService.error('Error al eliminar la foto');
            this.resetPendingPictureState();
          }
        })
      );
    }
    // Handle picture upload
    else if (this.pendingProfilePictureFile) {
      const fileToUpload = this.pendingProfilePictureFile; // Capture before reset
      this.subscriptions.add(
        this.profileService.uploadProfilePicture(fileToUpload).subscribe({
          next: (response) => {
            this.profilePicture = response.profilePictureUrl;
            // Update auth state so other components can access the picture
            this.authService.updateCurrentUser({
              profilePictureUrl: response.profilePictureUrl
            });
            this.cacheProfileData();
            this.resetPendingPictureState();
            this.cdr.detectChanges(); // Force UI update
            this.toastService.success('Foto de perfil actualizada');
          },
          error: (err) => {
            console.error('Failed to upload profile picture:', err);
            this.toastService.error('Error al subir la foto');
            this.resetPendingPictureState();
          }
        })
      );
    } else {
      this.resetPendingPictureState();
    }
  }

  private resetPendingPictureState() {
    this.pendingProfilePicture = null;
    this.pendingProfilePictureFile = null;
    this.pendingPictureRemoval = false;
    this.hasPendingPictureChange = false;
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

  onLanguageChange(languageCode: string) {
    if (this.isChangingLanguage || languageCode === this.preferredLanguage) {
      return;
    }

    this.isChangingLanguage = true;
    const previousLanguage = this.preferredLanguage;

    // Optimistic update
    this.preferredLanguage = languageCode;

    this.subscriptions.add(
      this.profileService.updateLanguage(languageCode).subscribe({
        next: () => {
          this.isChangingLanguage = false;
          this.toastService.success('Idioma actualizado');
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to update language:', error);
          // Revert on error
          this.preferredLanguage = previousLanguage;
          this.isChangingLanguage = false;
          this.toastService.error('Error al cambiar idioma');
          this.cdr.detectChanges();
        }
      })
    );
  }

  getLanguageName(code: string): string {
    const lang = this.availableLanguages.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  }
}
