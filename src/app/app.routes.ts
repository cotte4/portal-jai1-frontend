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
import { AdminTickets } from './components/admin-tickets/admin-tickets';
import { UserMessages } from './components/user-messages/user-messages';
import { ForgotPassword } from './components/forgot-password/forgot-password';
import { ResetPassword } from './components/reset-password/reset-password';
import { Chatbot } from './components/chatbot/chatbot';
import { MainLayout } from './components/main-layout/main-layout';
import { Profile } from './components/profile/profile';
import { Onboarding } from './components/onboarding/onboarding';
import { ReferralProgram } from './components/referral-program/referral-program';
import { Leaderboard } from './components/leaderboard/leaderboard';
import { GoogleCallback } from './components/google-callback/google-callback';


export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // Public routes
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: 'auth/google/callback', component: GoogleCallback },

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

  {
  path: 'admin/referrals',
  loadComponent: () => import('./components/admin-referrals/admin-referrals').then(m => m.AdminReferrals),
  canActivate: [adminGuard]
  },

  {
  path: 'admin/accounts',
  loadComponent: () => import('./components/admin-accounts/admin-accounts').then(m => m.AdminAccounts),
  canActivate: [adminGuard]
  },

  {
  path: 'admin/tickets',
  component: AdminTickets,
  canActivate: [adminGuard]
  },

  {
  path: 'admin/payments',
  loadComponent: () => import('./components/admin-payments/admin-payments').then(m => m.AdminPayments),
  canActivate: [adminGuard]
  },

  {
  path: 'admin/delays',
  loadComponent: () => import('./components/admin-delays/admin-delays').then(m => m.AdminDelays),
  canActivate: [adminGuard]
  },

  {
  path: 'admin/alarms',
  loadComponent: () => import('./components/admin-alarms/admin-alarms').then(m => m.AdminAlarms),
  canActivate: [adminGuard]
  },

  // Onboarding (full-screen, protected)
  {
    path: 'onboarding',
    component: Onboarding,
    canActivate: [authGuard]
  },

  // Referral Program (full-screen, protected)
  {
    path: 'referral-program',
    component: ReferralProgram,
    canActivate: [authGuard]
  },

  // Leaderboard (full-screen, protected)
  {
    path: 'leaderboard',
    component: Leaderboard,
    canActivate: [authGuard]
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
