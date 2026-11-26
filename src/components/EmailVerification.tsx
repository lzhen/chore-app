import type { EmailVerificationStatus } from '../utils/emailVerification';
import { Logo } from './Logo';
import { ThemeSelector } from './ThemeSelector';

interface EmailVerificationProps {
  verification: EmailVerificationStatus;
  onContinue: () => void;
}

export function EmailVerification({ verification, onContinue }: EmailVerificationProps) {
  const { status } = verification;

  return (
    <>
      <div className="theme-background" />
      <div className="min-h-screen flex items-center justify-center relative px-4 py-8">
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
          <ThemeSelector />
        </div>
        <div className="fluent-card p-6 sm:p-8 w-full max-w-md animate-fluent-appear text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" showText={true} />
          </div>

          {status === 'verifying' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
              </div>
              <h2 className="text-xl font-semibold text-content-primary mb-2">
                Verifying your email...
              </h2>
              <p className="text-content-secondary text-sm">
                Please wait while we confirm your email address.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-content-primary mb-2">
                Email Verified!
              </h2>
              <p className="text-content-secondary text-sm mb-6">
                Your email has been successfully verified.
              </p>
              <button
                onClick={onContinue}
                className="fluent-button w-full py-2.5"
              >
                Continue
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-content-primary mb-2">
                Verification Failed
              </h2>
              <p className="text-content-secondary text-sm mb-2">
                We couldn't use this email link. Open a newer link or return to sign in.
              </p>
              <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-fluent-sm text-red-500 text-sm mb-6">
                {verification.message}
              </div>
              <button
                onClick={onContinue}
                className="fluent-button w-full py-2.5"
              >
                Back to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
