import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Register } from './components/register/register';
import { Dashboard } from './components/dashboard/dashboard';
import { TaxForm } from './components/tax-form/tax-form';
import { TaxCalculator } from './components/tax-calculator/tax-calculator';
import { TaxTracking } from './components/tax-tracking/tax-tracking';
import { DocumentUpload } from './components/document-upload/document-upload';
import { AdminLogin } from './components/admin-login/admin-login';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';
import { AdminDashboard } from './components/admin-dashboard/admin-dashboard';
import { AdminClientDetail } from './components/admin-client-detail/admin-client-detail';
import { UserMessages } from './components/user-messages/user-messages';
import { ForgotPassword } from './components/forgot-password/forgot-password';
import { ResetPassword } from './components/reset-password/reset-password';
import { Chatbot } from './components/chatbot/chatbot';
import { MainLayout } from './components/main-layout/main-layout';
import { Profile } from './components/profile/profile';


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
  
  // Protected user routes - wrapped in MainLayout with sidebar
  { 
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'tax-form', component: TaxForm },
      { path: 'tax-calculator', component: TaxCalculator },
      { path: 'tax-tracking', component: TaxTracking },
      { path: 'documents', component: DocumentUpload },
      { path: 'messages', component: UserMessages },
      { path: 'chatbot', component: Chatbot },
      { path: 'profile', component: Profile }
    ]
  },

  { path: '**', redirectTo: '/login' }
];
