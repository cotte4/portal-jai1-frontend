// ============= ENUMS =============

export enum UserRole {
  CLIENT = 'client',
  ADMIN = 'admin'
}

// Unified case status
export enum CaseStatus {
  AWAITING_FORM = 'awaiting_form',
  AWAITING_DOCS = 'awaiting_docs',
  PREPARING = 'preparing',
  TAXES_FILED = 'taxes_filed',
  CASE_ISSUES = 'case_issues'
}

// Federal status (post-filing tracking)
export enum FederalStatusNew {
  IN_PROCESS = 'in_process',
  IN_VERIFICATION = 'in_verification',
  VERIFICATION_IN_PROGRESS = 'verification_in_progress',
  VERIFICATION_LETTER_SENT = 'verification_letter_sent',
  DEPOSIT_PENDING = 'deposit_pending',
  CHECK_IN_TRANSIT = 'check_in_transit',
  ISSUES = 'issues',
  TAXES_SENT = 'taxes_sent',
  TAXES_COMPLETED = 'taxes_completed'
}

// State status (post-filing tracking)
export enum StateStatusNew {
  IN_PROCESS = 'in_process',
  IN_VERIFICATION = 'in_verification',
  VERIFICATION_IN_PROGRESS = 'verification_in_progress',
  VERIFICATION_LETTER_SENT = 'verification_letter_sent',
  DEPOSIT_PENDING = 'deposit_pending',
  CHECK_IN_TRANSIT = 'check_in_transit',
  ISSUES = 'issues',
  TAXES_SENT = 'taxes_sent',
  TAXES_COMPLETED = 'taxes_completed'
}

// Alarm types
export type AlarmLevel = 'warning' | 'critical';
export type AlarmType = 'possible_verification_federal' | 'possible_verification_state' | 'verification_timeout' | 'letter_sent_timeout';
export type AlarmResolution = 'active' | 'acknowledged' | 'resolved' | 'auto_resolved';

export interface StatusAlarm {
  type: AlarmType;
  level: AlarmLevel;
  track: 'federal' | 'state';
  message: string;
  daysSinceStatusChange: number;
  threshold: number;
}

// Alarm Dashboard (for admin alarms page)
export interface AlarmDashboardItem {
  taxCaseId: string;
  clientName: string;
  clientEmail: string;
  alarms: StatusAlarm[];
  highestLevel: AlarmLevel | null;
  federalStatusNew: string | null;
  stateStatusNew: string | null;
  federalStatusNewChangedAt: string | null;
  stateStatusNewChangedAt: string | null;
  hasCustomThresholds: boolean;
}

export interface AlarmDashboardResponse {
  items: AlarmDashboardItem[];
  totalWithAlarms: number;
  totalCritical: number;
  totalWarning: number;
}

// Alarm History
export interface AlarmHistoryItem {
  id: string;
  taxCaseId: string;
  clientName: string;
  alarmType: AlarmType;
  alarmLevel: AlarmLevel;
  track: string;
  message: string;
  thresholdDays: number;
  actualDays: number;
  statusAtTrigger: string;
  statusChangedAt: string;
  resolution: AlarmResolution;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolvedNote: string | null;
  autoResolveReason: string | null;
  triggeredAt: string;
}

// Alarm Thresholds
export interface AlarmThresholds {
  federalInProcessDays: number;
  stateInProcessDays: number;
  verificationTimeoutDays: number;
  letterSentTimeoutDays: number;
  disableFederalAlarms: boolean;
  disableStateAlarms: boolean;
}

export interface ThresholdsResponse {
  taxCaseId: string;
  clientName: string;
  thresholds: AlarmThresholds;
  isCustom: boolean;
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SetThresholdsRequest {
  federalInProcessDays?: number | null;
  stateInProcessDays?: number | null;
  verificationTimeoutDays?: number | null;
  letterSentTimeoutDays?: number | null;
  disableFederalAlarms?: boolean;
  disableStateAlarms?: boolean;
  reason?: string;
}

// Default alarm thresholds (match backend)
export const DEFAULT_ALARM_THRESHOLDS = {
  POSSIBLE_VERIFICATION_FEDERAL: 25,
  POSSIBLE_VERIFICATION_STATE: 50,
  VERIFICATION_TIMEOUT: 63,
  LETTER_SENT_TIMEOUT: 63,
};

// Payment method for refund
export type PaymentMethod = 'bank_deposit' | 'check';

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
  hasProfile: boolean;
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  access_token: string;
  refresh_token: string;
  expires_in: number;
  hasProfile: boolean;
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
  phone?: string;
  isDraft: boolean;
  // Payment method for refund: 'bank_deposit' (default) or 'check'
  paymentMethod?: PaymentMethod;
}

// ============= TAX CASE =============

export interface TaxCase {
  id: string;
  clientProfileId: string;
  taxYear: number;
  // Estimated refund
  estimatedRefund?: number;
  // Computed fields (derived from federal/state)
  actualRefund?: number; // federalActualRefund + stateActualRefund
  refundDepositDate?: string; // federalDepositDate || stateDepositDate
  // Separate federal/state tracking (SOURCE OF TRUTH)
  federalEstimatedDate?: string;
  stateEstimatedDate?: string;
  federalActualRefund?: number;
  stateActualRefund?: number;
  federalDepositDate?: string;
  stateDepositDate?: string;
  // Federal status tracking
  federalLastComment?: string;
  federalStatusChangedAt?: string;
  federalLastReviewedAt?: string;
  // State status tracking
  stateLastComment?: string;
  stateStatusChangedAt?: string;
  stateLastReviewedAt?: string;
  // Status fields
  caseStatus?: CaseStatus;
  caseStatusChangedAt?: string;
  federalStatusNew?: FederalStatusNew;
  federalStatusNewChangedAt?: string;
  stateStatusNew?: StateStatusNew;
  stateStatusNewChangedAt?: string;
  // Alarms
  alarms?: StatusAlarm[];
  hasAlarm?: boolean;
  hasCriticalAlarm?: boolean;
  // Year-specific employment and banking
  workState?: string;
  employerName?: string;
  bankName?: string;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  // Payment method for refund
  paymentMethod?: PaymentMethod;
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

export interface TicketsPaginatedResponse {
  tickets: Ticket[];
  nextCursor: string | null;
  hasMore: boolean;
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

// Advanced filters for admin clients listing
export interface AdvancedFilters {
  hasProblem?: boolean | null;
  federalStatus?: FederalStatusNew | null;
  stateStatus?: StateStatusNew | null;
  caseStatus?: CaseStatus | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

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
  // Status fields
  caseStatus?: CaseStatus | null;
  caseStatusChangedAt?: string | null;
  federalStatusNew?: FederalStatusNew | null;
  federalStatusNewChangedAt?: string | null;
  stateStatusNew?: StateStatusNew | null;
  stateStatusNewChangedAt?: string | null;
  // Alarms
  alarms?: StatusAlarm[];
  hasAlarm?: boolean;
  hasCriticalAlarm?: boolean;
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
  comment?: string;
  federalComment?: string;
  stateComment?: string;
  federalEstimatedDate?: string;
  federalActualRefund?: number;
  federalDepositDate?: string;
  stateEstimatedDate?: string;
  stateActualRefund?: number;
  stateDepositDate?: string;
  // Status fields
  caseStatus?: CaseStatus;
  federalStatusNew?: FederalStatusNew;
  stateStatusNew?: StateStatusNew;
  // Force transition override
  forceTransition?: boolean;
  overrideReason?: string;
}

// ============= STATUS TRANSITIONS =============

export interface StatusTransitionInfo {
  current: string | null;
  validTransitions: string[];
}

export interface ValidTransitionsResponse {
  taxCaseId: string;
  caseStatus: StatusTransitionInfo;
  federalStatusNew: StatusTransitionInfo;
  stateStatusNew: StatusTransitionInfo;
}

export interface InvalidTransitionError {
  code: 'INVALID_STATUS_TRANSITION';
  statusType: 'case' | 'federal' | 'state';
  currentStatus: string | null;
  attemptedStatus: string;
  allowedTransitions: string[];
  message: string;
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
