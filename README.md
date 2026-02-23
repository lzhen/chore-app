# Chore App

[![CI](https://github.com/lizhen02/chore-app/actions/workflows/ci.yml/badge.svg)](https://github.com/lizhen02/chore-app/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/lizhen02/chore-app/actions/workflows/e2e.yml/badge.svg)](https://github.com/lizhen02/chore-app/actions/workflows/e2e.yml)
[![Deploy](https://github.com/lizhen02/chore-app/actions/workflows/deploy.yml/badge.svg)](https://github.com/lizhen02/chore-app/actions/workflows/deploy.yml)

A modern chore management application built with React, TypeScript, Vite, and Supabase.

## Features

- 📅 Calendar-based chore scheduling
- 👥 Team member management
- 🔐 Email authentication with Supabase
- 📧 Email verification
- 🔑 Password reset functionality
- 🎨 Multiple theme options

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/lizhen02/chore-app.git
cd chore-app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup

The app uses Supabase for authentication. The Supabase configuration is in `src/utils/supabase.ts`.

## Supabase Configuration

### Setting Up Redirect URLs

For email verification and password reset to work correctly, you must configure redirect URLs in your Supabase project.

#### Step 1: Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**

#### Step 2: Configure Site URL

Set your **Site URL** to your production domain:

| Environment | Site URL |
|-------------|----------|
| Production | `https://yourusername.github.io/chore-app` |
| Local Development | `http://localhost:5173` |

#### Step 3: Add Redirect URLs

Add the following URLs to the **Redirect URLs** list:

```
# Production (GitHub Pages)
https://yourusername.github.io/chore-app
https://yourusername.github.io/chore-app/

# Local Development
http://localhost:5173
http://localhost:5173/
http://localhost:5173/chore-app
http://localhost:5173/chore-app/

# Preview/Staging (if applicable)
http://localhost:4173
http://localhost:4173/chore-app
```

> **Important:** Replace `yourusername` with your actual GitHub username.

#### Step 4: Save Configuration

Click **Save** to apply the changes.

### Email Templates (Optional)

You can customize email templates in **Authentication** → **Email Templates**:

| Template | Purpose |
|----------|---------|
| Confirm signup | Sent when users register |
| Reset password | Sent when users request password reset |
| Magic link | Sent for passwordless login (if enabled) |

### Redirect URL Reference

The app uses these redirect patterns:

| Flow | Redirect URL Pattern |
|------|---------------------|
| Email Verification | `{site_url}#access_token=...&type=signup` |
| Password Reset | `{site_url}#access_token=...&type=recovery` |

The app automatically detects these URL hash patterns and shows the appropriate page:
- `type=signup` or `type=email` → Email Verification page
- `type=recovery` → Password Reset page

### Troubleshooting

#### "Fail to fetch" Error

This error typically occurs when:

1. **Redirect URL not configured**: Add your app URL to Supabase redirect URLs
2. **Invalid API key**: Verify your Supabase anon key in `src/utils/supabase.ts`
3. **CORS issues**: Ensure your domain is in the allowed list

#### Email Not Received

1. Check spam/junk folder
2. Verify email is correct
3. Check Supabase dashboard **Authentication** → **Users** for user status
4. Review **Authentication** → **Logs** for delivery issues

#### Verification Link Expired

Supabase email links expire after 24 hours by default. Users can request a new link by:
1. Going to sign in page
2. Clicking "Forgot your password?" (for password reset)
3. Or registering again (for email verification)

## Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Testing
npm test             # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
npm run typecheck    # Run TypeScript type checking

# Deployment
npm run deploy       # Build and deploy to GitHub Pages
```

## Pre-commit Hooks

The project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) to run checks before each commit.

### What Runs on Commit

| Check | Description |
|-------|-------------|
| **ESLint** | Lints staged `.ts` and `.tsx` files |
| **TypeScript** | Type checks the entire project |
| **Tests** | Runs all tests |

### Setup

Pre-commit hooks are automatically installed when you run `npm install` (via the `prepare` script).

### Manual Installation

If hooks aren't working, run:

```bash
npm run prepare
```

### Skipping Hooks (Emergency Only)

In rare cases where you need to skip hooks:

```bash
git commit --no-verify -m "your message"
```

> ⚠️ **Warning**: Only skip hooks in emergencies. All checks run in CI anyway.

### Configuration

The lint-staged configuration in `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "bash -c 'npm run typecheck'"
    ],
    "*.{js,jsx,json,md,yml,yaml}": [
      "prettier --write --ignore-unknown"
    ]
  }
}
```

### Troubleshooting

#### Hooks Not Running

1. Ensure Husky is installed: `npm run prepare`
2. Check `.husky/pre-commit` exists and is executable
3. Verify Git version supports hooks

#### Tests Failing on Commit

Run tests manually to see detailed output:

```bash
npm run test:run
```

#### TypeScript Errors

Run type check manually:

```bash
npm run typecheck
```

## Testing

The app includes comprehensive tests:

```bash
# Unit & Integration Tests (Vitest)
npm test             # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage

# E2E Tests (Playwright)
npm run test:e2e           # Run all e2e tests
npm run test:e2e:ui        # Run with interactive UI
npm run test:e2e:headed    # Run with visible browser
npm run test:e2e:chromium  # Run on Chromium only
npm run test:e2e:report    # View HTML report
```

### Test Coverage

| Component | Coverage |
|-----------|----------|
| AuthForm | 100% |
| EmailVerification | 100% |
| PasswordReset | 100% |
| AuthContext | 95%+ |

### Integration Tests

Full user journey tests:
- Registration → Email Verification → Login
- Forgot Password → Reset → Login with new password

### E2E Tests (Playwright)

End-to-end tests covering full authentication flows:

| Test Suite | Description |
|------------|-------------|
| **Authentication Page** | Sign in form display, theme selector, logo |
| **Registration Flow** | Navigation, form validation, field requirements |
| **Login Flow** | Form input, validation, masked password |
| **Password Reset Flow** | Navigation, email-only form, back navigation |
| **Form Validation** | Required fields, email format, error clearing |
| **Accessibility** | Labels, keyboard navigation, focus management |
| **Responsive Design** | Mobile, tablet, desktop viewports |

#### Running E2E Tests Locally

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all e2e tests
npm run test:e2e

# Run with UI mode for debugging
npm run test:e2e:ui

# Run specific browser only
npm run test:e2e:chromium

# View the HTML report after tests
npm run test:e2e:report
```

#### Browser Coverage

| Browser | Platform |
|---------|----------|
| Chromium | Desktop |
| Firefox | Desktop |
| WebKit (Safari) | Desktop |
| Chrome | Mobile (Pixel 5) |
| Safari | Mobile (iPhone 12) |

## Deployment

### GitHub Pages

```bash
npm run deploy
```

This builds the app and pushes to the `gh-pages` branch.

### Manual Deployment

```bash
npm run build
# Deploy the `dist` folder to your hosting provider
```

## CI/CD

The project uses GitHub Actions for continuous integration and deployment.

### Workflows

#### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`/`master`:

| Job | Description |
|-----|-------------|
| **Lint** | Runs ESLint to check code quality |
| **Test** | Runs all tests and generates coverage report |
| **Build** | Builds the production bundle |
| **Test Matrix** | Tests across Node.js 18, 20, and 22 |

#### E2E Workflow (`.github/workflows/e2e.yml`)

Runs Playwright end-to-end tests:

| Job | Trigger | Description |
|-----|---------|-------------|
| **E2E Tests** | Push & PR | Chromium-only tests for fast feedback |
| **E2E Tests (All Browsers)** | Push to main | Full browser matrix testing |

#### Deploy Workflow (`.github/workflows/deploy.yml`)

Runs on push to `main`/`master` or manual trigger:

| Job | Description |
|-----|-------------|
| **Test** | Runs all tests (gate for deployment) |
| **Build** | Builds production bundle |
| **Deploy** | Deploys to GitHub Pages |

### Workflow Triggers

| Event | CI | Deploy |
|-------|-----|--------|
| Push to main/master | ✅ | ✅ |
| Pull Request | ✅ | ❌ |
| Manual (workflow_dispatch) | ❌ | ✅ |

### Setting Up GitHub Actions

1. **Enable GitHub Pages**:
   - Go to repository **Settings** → **Pages**
   - Set source to **GitHub Actions**

2. **Required Permissions**:
   The deploy workflow requires these permissions (already configured):
   - `contents: read`
   - `pages: write`
   - `id-token: write`

3. **View Workflow Runs**:
   - Go to repository **Actions** tab
   - Select a workflow to view run history and logs

## Project Structure

```
src/
├── components/          # React components
│   ├── AuthForm.tsx    # Sign in/up/forgot password form
│   ├── EmailVerification.tsx  # Email verification page
│   ├── PasswordReset.tsx      # Password reset page
│   └── ...
├── context/            # React contexts
│   ├── AuthContext.tsx # Authentication state management
│   └── ...
├── test/               # Test utilities
│   ├── setup.ts        # Test setup and mocks
│   ├── testUtils.tsx   # Test helper functions
│   └── auth.integration.test.tsx  # Integration tests
└── utils/
    └── supabase.ts     # Supabase client configuration
```

## License

MIT
