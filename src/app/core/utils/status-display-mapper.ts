import { FederalStatusNew, StateStatusNew, CaseStatus, TaxStatus } from '../models';

/**
 * Display status types for UI rendering
 * Maps complex backend status enums to simple UI states
 */
export type DisplayStatus = 'pending' | 'active' | 'completed' | 'rejected';

/**
 * Maps Federal status (NEW v2 system or OLD system) to display status
 *
 * Priority: NEW system (FederalStatusNew) → OLD system (TaxStatus) → default
 *
 * @param status - Can be FederalStatusNew enum value or TaxStatus enum value
 * @returns DisplayStatus for UI rendering
 */
export function mapFederalStatusToDisplay(
  status: FederalStatusNew | TaxStatus | string | null | undefined
): DisplayStatus {
  if (!status) return 'pending';

  // NEW STATUS SYSTEM (v2) - Primary
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
    case FederalStatusNew.VERIFICATION_LETTER_SENT:
    case 'in_process':
    case 'in_verification':
    case 'verification_in_progress':
    case 'verification_letter_sent':
      return 'active';

    // OLD STATUS SYSTEM (fallback for backward compatibility)
    case TaxStatus.APPROVED:
    case TaxStatus.DEPOSITED:
    case 'approved':
    case 'deposited':
      return 'completed';

    case TaxStatus.REJECTED:
    case 'rejected':
      return 'rejected';

    case TaxStatus.PROCESSING:
    case 'processing':
      return 'active';

    case TaxStatus.FILED:
    case TaxStatus.PENDING:
    case 'filed':
    case 'pending':
      return 'pending';

    default:
      return 'pending';
  }
}

/**
 * Maps State status (NEW v2 system or OLD system) to display status
 *
 * Priority: NEW system (StateStatusNew) → OLD system (TaxStatus) → default
 *
 * @param status - Can be StateStatusNew enum value or TaxStatus enum value
 * @returns DisplayStatus for UI rendering
 */
export function mapStateStatusToDisplay(
  status: StateStatusNew | TaxStatus | string | null | undefined
): DisplayStatus {
  if (!status) return 'pending';

  // NEW STATUS SYSTEM (v2) - Primary
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
    case StateStatusNew.VERIFICATION_LETTER_SENT:
    case 'in_process':
    case 'in_verification':
    case 'verification_in_progress':
    case 'verification_letter_sent':
      return 'active';

    // OLD STATUS SYSTEM (fallback for backward compatibility)
    case TaxStatus.APPROVED:
    case TaxStatus.DEPOSITED:
    case 'approved':
    case 'deposited':
      return 'completed';

    case TaxStatus.REJECTED:
    case 'rejected':
      return 'rejected';

    case TaxStatus.PROCESSING:
    case 'processing':
      return 'active';

    case TaxStatus.FILED:
    case TaxStatus.PENDING:
    case 'filed':
    case 'pending':
      return 'pending';

    default:
      return 'pending';
  }
}

/**
 * Maps Case status (NEW v2 system) to display status
 *
 * @param status - CaseStatus enum value
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
export function isFederalApproved(status: FederalStatusNew | TaxStatus | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.TAXES_COMPLETED ||
    status === FederalStatusNew.CHECK_IN_TRANSIT ||
    status === FederalStatusNew.TAXES_SENT ||
    status === TaxStatus.APPROVED ||
    status === TaxStatus.DEPOSITED ||
    status === 'taxes_completed' ||
    status === 'check_in_transit' ||
    status === 'taxes_sent' ||
    status === 'approved' ||
    status === 'deposited'
  );
}

/**
 * Helper: Check if federal status indicates rejection/issues
 */
export function isFederalRejected(status: FederalStatusNew | TaxStatus | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.ISSUES ||
    status === TaxStatus.REJECTED ||
    status === 'issues' ||
    status === 'rejected'
  );
}

/**
 * Helper: Check if federal status indicates deposited/completed
 */
export function isFederalDeposited(status: FederalStatusNew | TaxStatus | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.TAXES_COMPLETED ||
    status === TaxStatus.DEPOSITED ||
    status === 'taxes_completed' ||
    status === 'deposited'
  );
}

/**
 * Helper: Check if state status indicates approval/completion
 */
export function isStateApproved(status: StateStatusNew | TaxStatus | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.TAXES_COMPLETED ||
    status === StateStatusNew.CHECK_IN_TRANSIT ||
    status === StateStatusNew.TAXES_SENT ||
    status === TaxStatus.APPROVED ||
    status === TaxStatus.DEPOSITED ||
    status === 'taxes_completed' ||
    status === 'check_in_transit' ||
    status === 'taxes_sent' ||
    status === 'approved' ||
    status === 'deposited'
  );
}

/**
 * Helper: Check if state status indicates rejection/issues
 */
export function isStateRejected(status: StateStatusNew | TaxStatus | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.ISSUES ||
    status === TaxStatus.REJECTED ||
    status === 'issues' ||
    status === 'rejected'
  );
}

/**
 * Helper: Check if state status indicates deposited/completed
 */
export function isStateDeposited(status: StateStatusNew | TaxStatus | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.TAXES_COMPLETED ||
    status === TaxStatus.DEPOSITED ||
    status === 'taxes_completed' ||
    status === 'deposited'
  );
}
