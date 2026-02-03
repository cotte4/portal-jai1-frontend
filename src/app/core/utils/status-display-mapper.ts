import { FederalStatusNew, StateStatusNew, CaseStatus } from '../models';

/**
 * Display status types for UI rendering
 * Maps complex backend status enums to simple UI states
 */
export type DisplayStatus = 'pending' | 'active' | 'completed' | 'rejected';

/**
 * Observation category for card styling in the 3-stage tracking view
 */
export type ObservationCategory = 'pending' | 'in_progress' | 'completed' | 'issues';

/**
 * Maps FederalStatusNew to a Spanish UI label for the client-facing tracking
 */
export function mapFederalStatusToSpanishLabel(status: FederalStatusNew | string | null | undefined): string {
  if (!status) return 'Pendiente';

  switch (status) {
    case FederalStatusNew.IN_PROCESS:
    case 'in_process':
      return 'En proceso';
    case FederalStatusNew.IN_VERIFICATION:
    case 'in_verification':
      return 'En verificación';
    case FederalStatusNew.VERIFICATION_IN_PROGRESS:
    case 'verification_in_progress':
      return 'Verificación en progreso';
    case 'verification_letter_sent':
      return 'Carta de verificación enviada';
    case FederalStatusNew.CHECK_IN_TRANSIT:
    case 'check_in_transit':
      return 'Cheque en camino';
    case 'deposit_pending':
      return 'Depósito pendiente';
    case FederalStatusNew.ISSUES:
    case 'issues':
      return 'Problemas detectados';
    case FederalStatusNew.TAXES_SENT:
    case 'taxes_sent':
      return 'Reembolso enviado';
    case FederalStatusNew.TAXES_COMPLETED:
    case 'taxes_completed':
      return 'Completado';
    default:
      return 'Pendiente';
  }
}

/**
 * Maps StateStatusNew to a Spanish UI label for the client-facing tracking
 */
export function mapStateStatusToSpanishLabel(status: StateStatusNew | string | null | undefined): string {
  if (!status) return 'Pendiente';

  switch (status) {
    case StateStatusNew.IN_PROCESS:
    case 'in_process':
      return 'En proceso';
    case StateStatusNew.IN_VERIFICATION:
    case 'in_verification':
      return 'En verificación';
    case StateStatusNew.VERIFICATION_IN_PROGRESS:
    case 'verification_in_progress':
      return 'Verificación en progreso';
    case 'verification_letter_sent':
      return 'Carta de verificación enviada';
    case StateStatusNew.CHECK_IN_TRANSIT:
    case 'check_in_transit':
      return 'Cheque en camino';
    case 'deposit_pending':
      return 'Depósito pendiente';
    case StateStatusNew.ISSUES:
    case 'issues':
      return 'Problemas detectados';
    case StateStatusNew.TAXES_SENT:
    case 'taxes_sent':
      return 'Reembolso enviado';
    case StateStatusNew.TAXES_COMPLETED:
    case 'taxes_completed':
      return 'Completado';
    default:
      return 'Pendiente';
  }
}

/**
 * Categorizes a federal or state status into an ObservationCategory for card styling
 */
export function getStatusCategory(status: FederalStatusNew | StateStatusNew | string | null | undefined): ObservationCategory {
  if (!status) return 'pending';

  switch (status) {
    case 'taxes_completed':
      return 'completed';
    case 'issues':
      return 'issues';
    case 'in_process':
    case 'in_verification':
    case 'verification_in_progress':
    case 'verification_letter_sent':
    case 'check_in_transit':
    case 'deposit_pending':
    case 'taxes_sent':
      return 'in_progress';
    default:
      return 'pending';
  }
}

/**
 * Maps Federal status to display status
 *
 * @param status - FederalStatusNew enum value or string
 * @returns DisplayStatus for UI rendering
 */
export function mapFederalStatusToDisplay(
  status: FederalStatusNew | string | null | undefined
): DisplayStatus {
  if (!status) return 'pending';

  switch (status) {
    // Completed states
    case FederalStatusNew.TAXES_COMPLETED:
    case FederalStatusNew.CHECK_IN_TRANSIT:
    case FederalStatusNew.TAXES_SENT:
    case 'taxes_completed':
    case 'check_in_transit':
    case 'taxes_sent':
      return 'completed';

    // Rejected/Issue states
    case FederalStatusNew.ISSUES:
    case 'issues':
      return 'rejected';

    // Active/In-progress states
    case FederalStatusNew.IN_PROCESS:
    case FederalStatusNew.IN_VERIFICATION:
    case FederalStatusNew.VERIFICATION_IN_PROGRESS:
    case 'in_process':
    case 'in_verification':
    case 'verification_in_progress':
      return 'active';

    default:
      return 'pending';
  }
}

/**
 * Maps State status to display status
 *
 * @param status - StateStatusNew enum value or string
 * @returns DisplayStatus for UI rendering
 */
export function mapStateStatusToDisplay(
  status: StateStatusNew | string | null | undefined
): DisplayStatus {
  if (!status) return 'pending';

  switch (status) {
    // Completed states
    case StateStatusNew.TAXES_COMPLETED:
    case StateStatusNew.CHECK_IN_TRANSIT:
    case StateStatusNew.TAXES_SENT:
    case 'taxes_completed':
    case 'check_in_transit':
    case 'taxes_sent':
      return 'completed';

    // Rejected/Issue states
    case StateStatusNew.ISSUES:
    case 'issues':
      return 'rejected';

    // Active/In-progress states
    case StateStatusNew.IN_PROCESS:
    case StateStatusNew.IN_VERIFICATION:
    case StateStatusNew.VERIFICATION_IN_PROGRESS:
    case 'in_process':
    case 'in_verification':
    case 'verification_in_progress':
      return 'active';

    default:
      return 'pending';
  }
}

/**
 * Maps Case status to display status
 *
 * @param status - CaseStatus enum value or string
 * @returns DisplayStatus for UI rendering
 */
export function mapCaseStatusToDisplay(
  status: CaseStatus | string | null | undefined
): DisplayStatus {
  if (!status) return 'pending';

  switch (status) {
    // Completed state
    case CaseStatus.TAXES_FILED:
    case 'taxes_filed':
      return 'completed';

    // Active states
    case CaseStatus.PREPARING:
    case CaseStatus.AWAITING_FORM:
    case CaseStatus.AWAITING_DOCS:
    case 'preparing':
    case 'awaiting_form':
    case 'awaiting_docs':
      return 'active';

    // Issue states
    case CaseStatus.CASE_ISSUES:
    case 'case_issues':
      return 'rejected';

    default:
      return 'pending';
  }
}

/**
 * Helper: Check if federal status indicates approval/completion
 */
export function isFederalApproved(status: FederalStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.TAXES_COMPLETED ||
    status === FederalStatusNew.CHECK_IN_TRANSIT ||
    status === FederalStatusNew.TAXES_SENT ||
    status === 'taxes_completed' ||
    status === 'check_in_transit' ||
    status === 'taxes_sent'
  );
}

/**
 * Helper: Check if federal status indicates rejection/issues
 */
export function isFederalRejected(status: FederalStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.ISSUES ||
    status === 'issues'
  );
}

/**
 * Helper: Check if federal status indicates deposited/completed
 */
export function isFederalDeposited(status: FederalStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.TAXES_COMPLETED ||
    status === 'taxes_completed'
  );
}

/**
 * Helper: Check if state status indicates approval/completion
 */
export function isStateApproved(status: StateStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.TAXES_COMPLETED ||
    status === StateStatusNew.CHECK_IN_TRANSIT ||
    status === StateStatusNew.TAXES_SENT ||
    status === 'taxes_completed' ||
    status === 'check_in_transit' ||
    status === 'taxes_sent'
  );
}

/**
 * Helper: Check if state status indicates rejection/issues
 */
export function isStateRejected(status: StateStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.ISSUES ||
    status === 'issues'
  );
}

/**
 * Helper: Check if state status indicates deposited/completed
 */
export function isStateDeposited(status: StateStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.TAXES_COMPLETED ||
    status === 'taxes_completed'
  );
}
