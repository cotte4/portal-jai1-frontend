import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Register } from './components/register/register';
import { Dashboard } from './components/dashboard/dashboard';
import { TaxForm } from './components/tax-form/tax-form';
import { DocumentUpload } from './components/document-upload/document-upload';
import { AdminLogin } from './components/admin-login/admin-login';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';
import { AdminDashboard } from './components/admin-dashboard/admin-dashboard';
import { AdminClientDetail } from './components/admin-client-detail/admin-client-detail';
import { UserMessages } from './components/user-messages/user-messages';
import { ForgotPassword } from './components/forgot-password/forgot-password';
import { ResetPassword } from './components/reset-password/reset-password';


export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  
  // Public routes
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },

  // Admin routes
  { path: 'admin-login', component: AdminLogin },

  { 
  path: 'admin/dashboard', 
  component: AdminDashboard,
  canActivate: [adminGuard]
  },

  { 
  path: 'admin/client/:id', 
  component: AdminClientDetail,
  canActivate: [adminGuard]
  },
  
  // Protected user routes
  { 
    path: 'dashboard', 
    component: Dashboard,
    canActivate: [authGuard]
  },
  { 
    path: 'tax-form', 
    component: TaxForm,
    canActivate: [authGuard]
  },
  {
    path: 'documents',
    component: DocumentUpload,
    canActivate: [authGuard]
  },
  {
    path: 'messages',
    component: UserMessages,
    canActivate: [authGuard]
  },

  { path: '**', redirectTo: '/login' }
];