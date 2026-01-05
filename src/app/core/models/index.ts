// ============= ENUMS =============

export enum UserRole {
  CLIENT = 'client',
  ADMIN = 'admin'
}

export enum InternalStatus {
  REVISION_DE_REGISTRO = 'revision_de_registro',
  ESPERANDO_DATOS = 'esperando_datos',
  FALTA_DOCUMENTACION = 'falta_documentacion',
  EN_PROCESO = 'en_proceso',
  EN_VERIFICACION = 'en_verificacion',
  RESOLVIENDO_VERIFICACION = 'resolviendo_verificacion',
  INCONVENIENTES = 'inconvenientes',
  CHEQUE_EN_CAMINO = 'cheque_en_camino',
  ESPERANDO_PAGO_COMISION = 'esperando_pago_comision',
  PROCESO_FINALIZADO = 'proceso_finalizado'
}

export enum ClientStatus {
  ESPERANDO_DATOS = 'esperando_datos',
  CUENTA_EN_REVISION = 'cuenta_en_revision',
  TAXES_EN_PROCESO = 'taxes_en_proceso',
  TAXES_EN_CAMINO = 'taxes_en_camino',
  TAXES_DEPOSITADOS = 'taxes_depositados',
  PAGO_REALIZADO = 'pago_realizado',
  EN_VERIFICACION = 'en_verificacion',
  TAXES_FINALIZADOS = 'taxes_finalizados'
}

export enum TaxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DEPOSITED = 'deposited'
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
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
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
  internalStatus: InternalStatus;
  clientStatus: ClientStatus;
  federalStatus?: TaxStatus;
  stateStatus?: TaxStatus;
  estimatedRefund?: number;
  actualRefund?: number;
  refundDepositDate?: string;
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
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
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
  createdAt: string;
}

// ============= ADMIN =============

export interface AdminClientListItem {
  id: string;
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  internalStatus: InternalStatus;
  clientStatus: ClientStatus;
  paymentReceived: boolean;
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
  internalStatus: InternalStatus;
  clientStatus: ClientStatus;
  comment?: string;
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
