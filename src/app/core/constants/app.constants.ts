export const APP_CONSTANTS = {
  // File upload limits
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25MB
  MAX_FILE_SIZE_MB: 25,

  // Timeouts
  API_TIMEOUT_MS: 8000,
  SAFETY_TIMEOUT_MS: 8000,

  // Supported file types
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
  SUPPORTED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
};
