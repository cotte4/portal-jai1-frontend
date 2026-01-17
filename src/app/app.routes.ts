import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // Public routes - lazy loaded
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register').then(m => m.Register)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./components/forgot-password/forgot-password').then(m => m.ForgotPassword)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/reset-password/reset-password').then(m => m.ResetPassword)
  },
  {
    path: 'auth/google/callback',
    loadComponent: () => import('./components/google-callback/google-callback').then(m => m.GoogleCallback)
  },

  // Admin routes - lazy loaded
  {
    path: 'admin-login',
    loadComponent: () => import('./components/admin-login/admin-login').then(m => m.AdminLogin)
  },
  {
    path: 'admin/dashboard',
    loadComponent: () => import('./components/admin-dashboard/admin-dashboard').then(m => m.AdminDashboard),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/client/:id',
    loadComponent: () => import('./components/admin-client-detail/admin-client-detail').then(m => m.AdminClientDetail),
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
    loadComponent: () => import('./components/admin-tickets/admin-tickets').then(m => m.AdminTickets),
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

  // Full-screen protected routes - lazy loaded
  {
    path: 'onboarding',
    loadComponent: () => import('./components/onboarding/onboarding').then(m => m.Onboarding),
    canActivate: [authGuard]
  },
  {
    path: 'referral-program',
    loadComponent: () => import('./components/referral-program/referral-program').then(m => m.ReferralProgram),
    canActivate: [authGuard]
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./components/leaderboard/leaderboard').then(m => m.Leaderboard),
    canActivate: [authGuard]
  },

  // Protected user routes - wrapped in MainLayout with sidebar
  {
    path: '',
    loadComponent: () => import('./components/main-layout/main-layout').then(m => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./components/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'tax-form',
        loadComponent: () => import('./components/tax-form/tax-form').then(m => m.TaxForm)
      },
      {
        path: 'tax-calculator',
        loadComponent: () => import('./components/tax-calculator/tax-calculator').then(m => m.TaxCalculator)
      },
      {
        path: 'tax-tracking',
        loadComponent: () => import('./components/tax-tracking/tax-tracking').then(m => m.TaxTracking)
      },
      {
        path: 'documents',
        loadComponent: () => import('./components/document-upload/document-upload').then(m => m.DocumentUpload)
      },
      {
        path: 'messages',
        loadComponent: () => import('./components/user-messages/user-messages').then(m => m.UserMessages)
      },
      {
        path: 'chatbot',
        loadComponent: () => import('./components/chatbot/chatbot').then(m => m.Chatbot)
      },
      {
        path: 'profile',
        loadComponent: () => import('./components/profile/profile').then(m => m.Profile)
      }
    ]
  },

  { path: '**', redirectTo: '/login' }
];
