export enum ErrorCode {
  // Authentication
  AUTH_MISSING = 'AUTH_MISSING',
  AUTH_INVALID_KEY = 'AUTH_INVALID_KEY',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_REVOKED = 'AUTH_REVOKED'
}

export type ApiErrorPayload = {
  error: {
    code: ErrorCode;
    message: string;
  };
};

export const apiError = (code: ErrorCode, message: string): ApiErrorPayload => {
  return {
    error: {
      code,
      message
    }
  };
};
