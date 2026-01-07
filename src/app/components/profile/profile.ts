import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileResponse, Address } from '../../core/models';
import { timeout, catchError, filter } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';

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
      },
      error: () => {
        // Stop loading even on error
        this.isLoading = false;
      }
    });

    // Safety timeout - stop loading after 3 seconds no matter what
    setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
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
