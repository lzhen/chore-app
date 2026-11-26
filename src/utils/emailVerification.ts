export type EmailVerificationStatus =
  | { status: 'verifying' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export type EmailVerificationCallback =
  | { accessToken: string; refreshToken: string }
  | { errorMessage: string };

export const emailVerificationFailure = 'This email link could not be completed.';

export function parseEmailVerificationCallback(hash: string, search: string): EmailVerificationCallback | null {
  const fragment = new URLSearchParams(hash.slice(1));
  const fragmentType = fragment.get('type');
  if (fragmentType === 'recovery') return null;
  // Supabase reads the last value for each key and lets the query override the fragment.
  const parameters = new Map([...fragment, ...new URLSearchParams(search)]);
  const type = parameters.get('type');
  const isVerificationType = type === 'signup' || type === 'email';
  const isVerificationFragment = fragmentType === 'signup' || fragmentType === 'email';
  const fragmentHasToken = !!fragment.get('access_token');
  const errorCode = fragment.get('error_code') || parameters.get('error_code');
  const description = fragment.get('error_description')?.trim() || parameters.get('error_description')?.trim();
  const hasError = !!(fragment.get('error') || parameters.get('error') || errorCode || description);
  if (!isVerificationFragment && errorCode !== 'otp_expired' && !(fragmentHasToken && (isVerificationType || hasError))) {
    return null;
  }

  if (hasError) {
    const fallback = errorCode === 'otp_expired' ? 'This email link is invalid or has expired.' : emailVerificationFailure;
    return { errorMessage: description || fallback };
  }

  const accessToken = parameters.get('access_token');
  const refreshToken = parameters.get('refresh_token');
  if (!isVerificationType || !accessToken || !refreshToken || !parameters.get('expires_in') || !parameters.get('token_type')) {
    return { errorMessage: emailVerificationFailure };
  }

  return { accessToken, refreshToken };
}
