import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ProfileResponse, Address } from '../../core/models';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);

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
    street: '',
    city: '',
    state: '',
    zip: ''
  };

  ngOnInit() {
    this.loadProfile();
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

    // Load profile picture from localStorage
    const savedPicture = localStorage.getItem('profilePicture');
    if (savedPicture) {
      this.profilePicture = savedPicture;
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
        // Save to localStorage for persistence
        localStorage.setItem('profilePicture', result);
        this.successMessage = '¡Foto de perfil actualizada!';
        setTimeout(() => this.successMessage = '', 3000);
      };
      reader.readAsDataURL(file);
    }
  }

  removeProfilePicture() {
    this.profilePicture = null;
    localStorage.removeItem('profilePicture');
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
  }

  saveChanges() {
    // Block saving if profile is already verified (completed F2 form)
    if (this.isVerified) {
      return;
    }
    this.isSaving = true;

    // Save locally (in a real app, this would call an API)
    setTimeout(() => {
      this.userName = `${this.editForm.firstName} ${this.editForm.lastName}`.trim();
      this.userPhone = this.editForm.phone;
      this.address = {
        street: this.editForm.street,
        city: this.editForm.city,
        state: this.editForm.state,
        zip: this.editForm.zip
      };
      
      // Save to localStorage for persistence
      localStorage.setItem('profileData', JSON.stringify({
        userName: this.userName,
        phone: this.userPhone,
        address: this.address
      }));
      
      this.isSaving = false;
      this.isEditing = false;
      this.successMessage = '¡Cambios guardados correctamente!';
      setTimeout(() => this.successMessage = '', 3000);
    }, 500);
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
