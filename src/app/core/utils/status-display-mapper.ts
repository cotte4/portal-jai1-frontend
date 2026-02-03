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
 * Interno statuses collapse to their parent labels
 */
export function mapFederalStatusToSpanishLabel(status: FederalStatusNew | string | null | undefined): string {
  if (!status) return 'Pendiente';

  switch (status) {
    case FederalStatusNew.TAXES_EN_PROCESO:
    case 'taxes_en_proceso':
      return 'Taxes en proceso';
    case FederalStatusNew.EN_VERIFICACION:
    case 'en_verificacion':
      return 'En verificacion';
    case FederalStatusNew.VERIFICACION_EN_PROGRESO:
    case 'verificacion_en_progreso':
      return 'En verificacion'; // interno → parent label
    case FederalStatusNew.PROBLEMAS:
    case 'problemas':
      return 'Problemas';
    case FederalStatusNew.VERIFICACION_RECHAZADA:
    case 'verificacion_rechazada':
      return 'Verificacion rechazada';
    case FederalStatusNew.DEPOSITO_DIRECTO:
    case 'deposito_directo':
      return 'Reembolso enviado'; // interno → parent label
    case FederalStatusNew.CHEQUE_EN_CAMINO:
    case 'cheque_en_camino':
      return 'Reembolso enviado'; // interno → parent label
    case FederalStatusNew.COMISION_PENDIENTE:
    case 'comision_pendiente':
      return 'Comision pendiente de pago';
    case FederalStatusNew.TAXES_COMPLETADOS:
    case 'taxes_completados':
      return 'Taxes completados';
    default:
      return 'Pendiente';
  }
}

/**
 * Maps StateStatusNew to a Spanish UI label for the client-facing tracking
 * Interno statuses collapse to their parent labels
 */
export function mapStateStatusToSpanishLabel(status: StateStatusNew | string | null | undefined): string {
  if (!status) return 'Pendiente';

  switch (status) {
    case StateStatusNew.TAXES_EN_PROCESO:
    case 'taxes_en_proceso':
      return 'Taxes en proceso';
    case StateStatusNew.EN_VERIFICACION:
    case 'en_verificacion':
      return 'En verificacion';
    case StateStatusNew.VERIFICACION_EN_PROGRESO:
    case 'verificacion_en_progreso':
      return 'En verificacion'; // interno → parent label
    case StateStatusNew.PROBLEMAS:
    case 'problemas':
      return 'Problemas';
    case StateStatusNew.VERIFICACION_RECHAZADA:
    case 'verificacion_rechazada':
      return 'Verificacion rechazada';
    case StateStatusNew.DEPOSITO_DIRECTO:
    case 'deposito_directo':
      return 'Reembolso enviado'; // interno → parent label
    case StateStatusNew.CHEQUE_EN_CAMINO:
    case 'cheque_en_camino':
      return 'Reembolso enviado'; // interno → parent label
    case StateStatusNew.COMISION_PENDIENTE:
    case 'comision_pendiente':
      return 'Comision pendiente de pago';
    case StateStatusNew.TAXES_COMPLETADOS:
    case 'taxes_completados':
      return 'Taxes completados';
    default:
      return 'Pendiente';
  }
}

/**
 * Categorizes a federal or state status into an ObservationCategory for card styling
 * Green: deposito_directo, cheque_en_camino, comision_pendiente, taxes_completados
 * Yellow: taxes_en_proceso
 * Red: en_verificacion, verificacion_en_progreso, problemas, verificacion_rechazada
 */
export function getStatusCategory(status: FederalStatusNew | StateStatusNew | string | null | undefined): ObservationCategory {
  if (!status) return 'pending';

  switch (status) {
    // Green (completed)
    case 'deposito_directo':
    case 'cheque_en_camino':
    case 'comision_pendiente':
    case 'taxes_completados':
      return 'completed';
    // Yellow (in_progress)
    case 'taxes_en_proceso':
      return 'in_progress';
    // Red (issues)
    case 'en_verificacion':
    case 'verificacion_en_progreso':
    case 'problemas':
    case 'verificacion_rechazada':
      return 'issues';
    default:
      return 'pending';
  }
}

/**
 * Maps Federal status to display status
 */
export function mapFederalStatusToDisplay(
  status: FederalStatusNew | string | null | undefined
): DisplayStatus {
  if (!status) return 'pending';

  switch (status) {
    // Completed states (green)
    case FederalStatusNew.DEPOSITO_DIRECTO:
    case FederalStatusNew.CHEQUE_EN_CAMINO:
    case FederalStatusNew.COMISION_PENDIENTE:
    case FederalStatusNew.TAXES_COMPLETADOS:
    case 'deposito_directo':
    case 'cheque_en_camino':
    case 'comision_pendiente':
    case 'taxes_completados':
      return 'completed';

    // Rejected/Issue states (red)
    case FederalStatusNew.PROBLEMAS:
    case FederalStatusNew.EN_VERIFICACION:
    case FederalStatusNew.VERIFICACION_EN_PROGRESO:
    case FederalStatusNew.VERIFICACION_RECHAZADA:
    case 'problemas':
    case 'en_verificacion':
    case 'verificacion_en_progreso':
    case 'verificacion_rechazada':
      return 'rejected';

    // Active/In-progress states (yellow)
    case FederalStatusNew.TAXES_EN_PROCESO:
    case 'taxes_en_proceso':
      return 'active';

    default:
      return 'pending';
  }
}

/**
 * Maps State status to display status
 */
export function mapStateStatusToDisplay(
  status: StateStatusNew | string | null | undefined
): DisplayStatus {
  if (!status) return 'pending';

  switch (status) {
    // Completed states (green)
    case StateStatusNew.DEPOSITO_DIRECTO:
    case StateStatusNew.CHEQUE_EN_CAMINO:
    case StateStatusNew.COMISION_PENDIENTE:
    case StateStatusNew.TAXES_COMPLETADOS:
    case 'deposito_directo':
    case 'cheque_en_camino':
    case 'comision_pendiente':
    case 'taxes_completados':
      return 'completed';

    // Rejected/Issue states (red)
    case StateStatusNew.PROBLEMAS:
    case StateStatusNew.EN_VERIFICACION:
    case StateStatusNew.VERIFICACION_EN_PROGRESO:
    case StateStatusNew.VERIFICACION_RECHAZADA:
    case 'problemas':
    case 'en_verificacion':
    case 'verificacion_en_progreso':
    case 'verificacion_rechazada':
      return 'rejected';

    // Active/In-progress states (yellow)
    case StateStatusNew.TAXES_EN_PROCESO:
    case 'taxes_en_proceso':
      return 'active';

    default:
      return 'pending';
  }
}

/**
 * Maps Case status to display status
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
 * Helper: Check if federal status indicates approval/completion (green)
 */
export function isFederalApproved(status: FederalStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.DEPOSITO_DIRECTO ||
    status === FederalStatusNew.CHEQUE_EN_CAMINO ||
    status === FederalStatusNew.COMISION_PENDIENTE ||
    status === FederalStatusNew.TAXES_COMPLETADOS ||
    status === 'deposito_directo' ||
    status === 'cheque_en_camino' ||
    status === 'comision_pendiente' ||
    status === 'taxes_completados'
  );
}

/**
 * Helper: Check if federal status indicates rejection/issues (red)
 */
export function isFederalRejected(status: FederalStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.PROBLEMAS ||
    status === FederalStatusNew.EN_VERIFICACION ||
    status === FederalStatusNew.VERIFICACION_EN_PROGRESO ||
    status === FederalStatusNew.VERIFICACION_RECHAZADA ||
    status === 'problemas' ||
    status === 'en_verificacion' ||
    status === 'verificacion_en_progreso' ||
    status === 'verificacion_rechazada'
  );
}

/**
 * Helper: Check if federal status indicates deposited/completed
 */
export function isFederalDeposited(status: FederalStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === FederalStatusNew.TAXES_COMPLETADOS ||
    status === 'taxes_completados'
  );
}

/**
 * Helper: Check if state status indicates approval/completion (green)
 */
export function isStateApproved(status: StateStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.DEPOSITO_DIRECTO ||
    status === StateStatusNew.CHEQUE_EN_CAMINO ||
    status === StateStatusNew.COMISION_PENDIENTE ||
    status === StateStatusNew.TAXES_COMPLETADOS ||
    status === 'deposito_directo' ||
    status === 'cheque_en_camino' ||
    status === 'comision_pendiente' ||
    status === 'taxes_completados'
  );
}

/**
 * Helper: Check if state status indicates rejection/issues (red)
 */
export function isStateRejected(status: StateStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.PROBLEMAS ||
    status === StateStatusNew.EN_VERIFICACION ||
    status === StateStatusNew.VERIFICACION_EN_PROGRESO ||
    status === StateStatusNew.VERIFICACION_RECHAZADA ||
    status === 'problemas' ||
    status === 'en_verificacion' ||
    status === 'verificacion_en_progreso' ||
    status === 'verificacion_rechazada'
  );
}

/**
 * Helper: Check if state status indicates deposited/completed
 */
export function isStateDeposited(status: StateStatusNew | string | null | undefined): boolean {
  if (!status) return false;

  return (
    status === StateStatusNew.TAXES_COMPLETADOS ||
    status === 'taxes_completados'
  );
}
