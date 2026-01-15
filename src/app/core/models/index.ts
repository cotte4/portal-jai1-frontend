// ============= ENUMS =============

export enum UserRole {
  CLIENT = 'client',
  ADMIN = 'admin'
}

export enum TaxStatus {
  FILED = 'filed',
  PENDING = 'pending',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DEPOSITED = 'deposited'
}

// NEW: Pre-filing workflow status (before taxes are filed)
export enum PreFilingStatus {
  AWAITING_REGISTRATION = 'awaiting_registration',
  AWAITING_DOCUMENTS = 'awaiting_documents',
  DOCUMENTATION_COMPLETE = 'documentation_complete'
}

export enum DocumentType {
  W2 = 'w2',
  PAYMENT_PROOF = 'payment_proof',
  OTHER = 'other'
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed'
}

export enum NotificationType {
  STATUS_CHANGE = 'status_change',
  DOCS_MISSING = 'docs_missing',
  MESSAGE = 'message',
  SYSTEM = 'system',
  PROBLEM_ALERT = 'problem_alert'
}

export enum ProblemType {
  MISSING_DOCUMENTS = 'missing_documents',
  INCORRECT_INFORMATION = 'incorrect_information',
  IRS_VERIFICATION = 'irs_verification',
  BANK_ISSUE = 'bank_issue',
  STATE_ISSUE = 'state_issue',
  FEDERAL_ISSUE = 'federal_issue',
  CLIENT_UNRESPONSIVE = 'client_unresponsive',
  OTHER = 'other'
}

// ============= AUTH =============

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  referralCode?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ============= USER =============

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePictureUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============= PROFILE =============

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface BankInfo {
  name: string;
  routingNumber: string;
  accountNumber: string;
}

export interface ClientProfile {
  id: string;
  userId: string;
  ssn?: string;
  dateOfBirth?: string;
  address?: Address;
  bank?: BankInfo;
  workState?: string;
  employerName?: string;
  turbotaxEmail?: string;
  turbotaxPassword?: string;
  // IRS account credentials (admin-only view)
  irsUsername?: string;
  irsPassword?: string;
  // State account credentials (admin-only view)
  stateUsername?: string;
  statePassword?: string;
  profileComplete: boolean;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  user: User;
  profile: ClientProfile;
  taxCase?: TaxCase;
}

export interface CompleteProfileRequest {
  ssn: string;
  dateOfBirth: string;
  address: Address;
  bank: BankInfo;
  workState: string;
  employerName: string;
  turbotaxEmail?: string;
  turbotaxPassword?: string;
  isDraft: boolean;
}

// ============= TAX CASE =============

export interface TaxCase {
  id: string;
  clientProfileId: string;
  taxYear: number;
  // Phase indicator - separates pre-filing and post-filing
  taxesFiled?: boolean;
  taxesFiledAt?: string;
  // NEW: Pre-filing status (used when taxesFiled = false)
  preFilingStatus?: PreFilingStatus;
  // Federal/State status (used when taxesFiled = true)
  federalStatus?: TaxStatus;
  stateStatus?: TaxStatus;
  estimatedRefund?: number;
  // Computed fields (for backward compatibility - derived from federal/state)
  actualRefund?: number; // federalActualRefund + stateActualRefund
  refundDepositDate?: string; // federalDepositDate || stateDepositDate
  // Separate federal/state tracking (SOURCE OF TRUTH)
  federalEstimatedDate?: string;
  stateEstimatedDate?: string;
  federalActualRefund?: number;
  stateActualRefund?: number;
  federalDepositDate?: string;
  stateDepositDate?: string;
  // NEW: Federal status tracking
  federalLastComment?: string;
  federalStatusChangedAt?: string;
  federalLastReviewedAt?: string;
  // NEW: State status tracking
  stateLastComment?: string;
  stateStatusChangedAt?: string;
  stateLastReviewedAt?: string;
  // Year-specific employment and banking
  workState?: string;
  employerName?: string;
  bankName?: string;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  paymentReceived: boolean;
  commissionPaid: boolean;
  statusUpdatedAt: string;
  adminStep?: number;
  hasProblem: boolean;
  problemStep?: number;
  problemType?: ProblemType;
  problemDescription?: string;
  problemResolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============= DOCUMENTS =============

export interface Document {
  id: string;
  taxCaseId: string;
  type: DocumentType;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  taxYear?: number;
  isReviewed: boolean;
  uploadedAt: string;
}

export interface UploadDocumentRequest {
  file: File;
  type: DocumentType;
  taxYear?: number;
}

// ============= TICKETS =============

export interface Ticket {
  id: string;
  userId: string;
  subject: string;
  status: TicketStatus;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
  isRead?: boolean;
  createdAt: string;
  sender?: User;
}

export interface CreateTicketRequest {
  subject: string;
  message: string;
}

export interface AddMessageRequest {
  message: string;
}

// ============= NOTIFICATIONS =============

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
}

// ============= ADMIN =============

// Type-safe client status filter values for admin dashboard
export type ClientStatusFilter =
  | 'all'
  | 'group_pending'
  | 'group_in_review'
  | 'group_completed'
  | 'group_needs_attention'
  | 'ready_to_present'
  | 'incomplete';

export interface ClientCredentials {
  turbotaxEmail: string | null;
  turbotaxPassword: string | null;
  irsUsername: string | null;
  irsPassword: string | null;
  stateUsername: string | null;
  statePassword: string | null;
}

export interface AdminClientListItem {
  id: string;
  user: {
    id?: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  // SSN (masked)
  ssn?: string | null;
  // Phase-based status fields
  taxesFiled?: boolean;
  taxesFiledAt?: string | null;
  preFilingStatus?: PreFilingStatus;
  federalStatus?: TaxStatus;
  stateStatus?: TaxStatus;
  // Status tracking
  federalLastComment?: string | null;
  stateLastComment?: string | null;
  federalActualRefund?: number | null;
  stateActualRefund?: number | null;
  lastReviewDate?: string | null;
  // Account credentials (admin use only)
  credentials?: ClientCredentials;
  paymentReceived: boolean;
  profileComplete: boolean;
  isDraft: boolean;
  missingItems: string[];
  isReadyToPresent: boolean;
  createdAt: string;
}

export interface AdminClientListResponse {
  clients: AdminClientListItem[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface AdminClientDetail {
  id: string;
  user: User;
  profile: ClientProfile;
  taxCases: TaxCase[];
  documents: Document[];
  statusHistory: StatusHistory[];
}

export interface StatusHistory {
  id: string;
  taxCaseId: string;
  previousStatus?: string;
  newStatus: string;
  changedById: string;
  comment?: string;
  createdAt: string;
  changedBy?: User;
}

export interface UpdateStatusRequest {
  taxesFiled?: boolean;
  taxesFiledAt?: string;
  preFilingStatus?: PreFilingStatus;
  federalStatus?: TaxStatus;
  stateStatus?: TaxStatus;
  comment?: string;
  federalComment?: string;
  stateComment?: string;
  federalEstimatedDate?: string;
  federalActualRefund?: number;
  federalDepositDate?: string;
  stateEstimatedDate?: string;
  stateActualRefund?: number;
  stateDepositDate?: string;
}

// ============= CALCULATOR =============

export type OcrConfidence = 'high' | 'medium' | 'low';

export interface W2EstimateResponse {
  box2Federal: number;
  box17State: number;
  estimatedRefund: number;
  ocrConfidence: OcrConfidence;
  w2FileName: string;
  estimateId: string;
}

export interface W2EstimateHistoryItem {
  id: string;
  box2Federal: number;
  box17State: number;
  estimatedRefund: number;
  w2FileName: string;
  ocrConfidence: OcrConfidence;
  createdAt: string;
}

// ============= API RESPONSES =============

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}
