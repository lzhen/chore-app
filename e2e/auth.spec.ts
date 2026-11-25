import { test, expect, Page } from '@playwright/test';

// Helper class for auth page interactions
class AuthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async getEmailInput() {
    return this.page.getByLabel(/email/i);
  }

  async getPasswordInput() {
    return this.page.getByLabel(/password/i);
  }

  async fillEmail(email: string) {
    await (await this.getEmailInput()).fill(email);
  }

  async fillPassword(password: string) {
    await (await this.getPasswordInput()).fill(password);
  }

  async clickSignIn() {
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  async clickSignUp() {
    await this.page.getByRole('button', { name: /sign up/i }).click();
  }

  async clickSendResetLink() {
    await this.page.getByRole('button', { name: /send reset link/i }).click();
  }

  async switchToSignUp() {
    await this.page.getByText(/don't have an account\? sign up/i).click();
  }

  async switchToSignIn() {
    await this.page.getByText(/already have an account\? sign in/i).click();
  }

  async switchToForgotPassword() {
    await this.page.getByText(/forgot your password\?/i).click();
  }

  async switchBackToSignIn() {
    await this.page.getByText(/back to sign in/i).click();
  }

  async expectSignInPage() {
    await expect(this.page.getByText('Sign in to your account')).toBeVisible();
  }

  async expectSignUpPage() {
    await expect(this.page.getByText('Create an account')).toBeVisible();
  }

  async expectForgotPasswordPage() {
    await expect(this.page.getByRole('heading', { name: 'Reset your password', exact: true })).toBeVisible();
  }

  async expectErrorMessage(message: string | RegExp) {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async expectSuccessMessage(message: string | RegExp) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

test.describe('Authentication Page', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('displays sign in form by default', async ({ page }) => {
    await authPage.expectSignInPage();
    await expect(await authPage.getEmailInput()).toBeVisible();
    await expect(await authPage.getPasswordInput()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('has theme selector visible', async ({ page }) => {
    await expect(page.locator('[class*="theme"]').first()).toBeVisible();
  });

  test('has logo visible', async ({ page }) => {
    const logo = page.locator('.nesmi-logo');
    await expect(logo.getByText('Nesmi', { exact: true })).toBeVisible();
    const artwork = logo.locator('svg');
    await expect(artwork).toBeVisible();
    const source = await artwork.locator('image').getAttribute('href');
    expect(source).toContain('nesmi-1024-20261008.png');
    await expect.poll(() => page.evaluate(async (src) => {
      const img = new Image(); img.src = src!;
      await img.decode(); return img.naturalWidth;
    }, source)).toBeGreaterThan(0);
  });
});

test.describe('Registration Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('can navigate to sign up page', async () => {
    await authPage.expectSignInPage();
    await authPage.switchToSignUp();
    await authPage.expectSignUpPage();
  });

  test('can switch between sign up and sign in', async () => {
    await authPage.switchToSignUp();
    await authPage.expectSignUpPage();

    await authPage.switchToSignIn();
    await authPage.expectSignInPage();
  });

  test('shows email and password fields on sign up page', async ({ page }) => {
    await authPage.switchToSignUp();

    await expect(await authPage.getEmailInput()).toBeVisible();
    await expect(await authPage.getPasswordInput()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
  });

  test('can fill registration form', async () => {
    await authPage.switchToSignUp();

    await authPage.fillEmail('newuser@example.com');
    await authPage.fillPassword('SecurePassword123');

    await expect(await authPage.getEmailInput()).toHaveValue('newuser@example.com');
    await expect(await authPage.getPasswordInput()).toHaveValue('SecurePassword123');
  });

  test('validates required email field', async ({ page }) => {
    await authPage.switchToSignUp();
    await authPage.fillPassword('Password123');

    const emailInput = await authPage.getEmailInput();
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('validates required password field', async ({ page }) => {
    await authPage.switchToSignUp();
    await authPage.fillEmail('test@example.com');

    const passwordInput = await authPage.getPasswordInput();
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('password field has minimum length requirement', async () => {
    await authPage.switchToSignUp();

    const passwordInput = await authPage.getPasswordInput();
    await expect(passwordInput).toHaveAttribute('minlength', '6');
  });
});

test.describe('Login Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('can fill login form', async () => {
    await authPage.fillEmail('user@example.com');
    await authPage.fillPassword('MyPassword123');

    await expect(await authPage.getEmailInput()).toHaveValue('user@example.com');
    await expect(await authPage.getPasswordInput()).toHaveValue('MyPassword123');
  });

  test('email input accepts valid email format', async ({ page }) => {
    await authPage.fillEmail('valid@email.com');

    const emailInput = await authPage.getEmailInput();
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('password input is masked', async () => {
    const passwordInput = await authPage.getPasswordInput();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('sign in button is enabled with valid input', async ({ page }) => {
    await authPage.fillEmail('user@example.com');
    await authPage.fillPassword('Password123');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled();
  });
});

test.describe('Password Reset Request Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('can navigate to forgot password page', async () => {
    await authPage.expectSignInPage();
    await authPage.switchToForgotPassword();
    await authPage.expectForgotPasswordPage();
  });

  test('hides password field on forgot password page', async ({ page }) => {
    await authPage.switchToForgotPassword();

    await expect(await authPage.getEmailInput()).toBeVisible();
    await expect(page.getByLabel(/password/i)).not.toBeVisible();
  });

  test('shows send reset link button', async ({ page }) => {
    await authPage.switchToForgotPassword();

    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('can return to sign in from forgot password', async () => {
    await authPage.switchToForgotPassword();
    await authPage.expectForgotPasswordPage();

    await authPage.switchBackToSignIn();
    await authPage.expectSignInPage();
  });

  test('can fill email for password reset', async () => {
    await authPage.switchToForgotPassword();
    await authPage.fillEmail('forgot@example.com');

    await expect(await authPage.getEmailInput()).toHaveValue('forgot@example.com');
  });
});

test.describe('Password Recovery Exit', () => {
  test.use({ serviceWorkers: 'block' });

  test('offers a sign-out retry after updating the password during recovery', async ({ page }) => {
    const user = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'recovery@example.test',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    };
    const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({
      sub: user.id, exp: 2000000000, role: 'authenticated',
    })).toString('base64url') + '.test-only';
    const storageKey = 'sb-rosofbnimiothwxsabyr-auth-token';
    await page.addInitScript(({ storageKey, user, token }) => {
      localStorage.setItem(storageKey, JSON.stringify({
        access_token: token, refresh_token: 'mock-only', expires_at: 2000000000,
        expires_in: 999999, token_type: 'bearer', user,
      }));
    }, { storageKey, user, token });

    let updates = 0;
    const logoutScopes: (string | null)[] = [];
    await page.route('**/*.supabase.co/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/auth/v1/user') {
        if (request.method() === 'PUT') updates++;
        return route.fulfill({ json: user });
      }
      if (url.pathname === '/auth/v1/logout' && request.method() === 'POST') {
        logoutScopes.push(url.searchParams.get('scope'));
        return logoutScopes.length === 1
          ? route.fulfill({ status: 503, json: { message: 'Synthetic transport failure' } })
          : route.fulfill({ status: 204 });
      }
      return route.abort('blockedbyclient');
    });

    await page.goto('/chore-app/#type=recovery');
    await page.getByLabel('New Password', { exact: true }).fill('synthetic-password');
    await page.getByLabel('Confirm Password', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Reset Password', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Password Updated!' })).toBeVisible();

    const continueButton = page.getByRole('button', { name: 'Continue to Sign In', exact: true });
    await continueButton.click();
    await expect(page.getByRole('alert')).toHaveText('Could not sign out. Please try again.');
    await expect(page.getByRole('heading', { name: 'Password Updated!' })).toBeVisible();
    await expect(page).toHaveURL(/#type=recovery$/);
    expect(await page.evaluate(key => localStorage.getItem(key) !== null, storageKey)).toBe(true);

    await continueButton.click();
    await new AuthPage(page).expectSignInPage();
    await expect(page).toHaveURL(/\/chore-app\/$/);
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
    expect(logoutScopes).toEqual(['global', 'global']);
    expect(updates).toBe(1);
  });
});

test.describe('Form Validation', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('email input validates email format', async ({ page }) => {
    const emailInput = await authPage.getEmailInput();
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('all required fields are marked as required', async ({ page }) => {
    const emailInput = await authPage.getEmailInput();
    const passwordInput = await authPage.getPasswordInput();

    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('form clears error when switching modes', async ({ page }) => {
    // Start on sign in
    await authPage.expectSignInPage();

    // Switch to sign up
    await authPage.switchToSignUp();

    // Error messages should not be visible
    await expect(page.locator('.text-red-500')).not.toBeVisible();
  });
});

test.describe('Accessibility', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('form inputs have associated labels', async ({ page }) => {
    const emailInput = await authPage.getEmailInput();
    const passwordInput = await authPage.getPasswordInput();

    await expect(emailInput).toHaveAttribute('id');
    await expect(passwordInput).toHaveAttribute('id');
  });

  test('buttons are keyboard accessible', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await signInButton.focus();
    await expect(signInButton).toBeFocused();
  });

  test('can navigate form with tab', async ({ page }) => {
    await page.keyboard.press('Tab');

    // Should be able to tab through form elements
    const emailInput = await authPage.getEmailInput();
    await emailInput.focus();
    await expect(emailInput).toBeFocused();
  });
});

test.describe('Responsive Design', () => {
  test('renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const authPage = new AuthPage(page);
    await authPage.goto();

    await authPage.expectSignInPage();
    await expect(await authPage.getEmailInput()).toBeVisible();
    await expect(await authPage.getPasswordInput()).toBeVisible();
  });

  test('renders correctly on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const authPage = new AuthPage(page);
    await authPage.goto();

    await authPage.expectSignInPage();
    await expect(await authPage.getEmailInput()).toBeVisible();
  });

  test('renders correctly on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    const authPage = new AuthPage(page);
    await authPage.goto();

    await authPage.expectSignInPage();
    await expect(await authPage.getEmailInput()).toBeVisible();
  });
});
