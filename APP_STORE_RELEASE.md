# Chorely iOS release

App name: **Chorely**  
Bundle ID: `com.pawssible.chorely`  
Initial version: `1.0.0`  
Initial build: `1`

## Create and open the iOS project

On a Mac with Xcode installed:

```bash
npm install
npm run ios:init
npm run ios:open
```

After the first run, use `npm run ios:sync` whenever the web app changes.

## Xcode signing

1. Select the **App** target, then **Signing & Capabilities**.
2. Choose the Apple Developer team for Pawssible Studio.
3. Keep **Automatically manage signing** enabled.
4. Confirm the bundle identifier is `com.pawssible.chorely`.
5. Set version `1.0.0` and build `1`.

## Upload to TestFlight

1. In App Store Connect, create the Chorely app with the bundle ID above.
2. In Xcode, select **Any iOS Device (arm64)**.
3. Choose **Product → Archive**.
4. In Organizer, choose **Distribute App → App Store Connect → Upload**.
5. Complete export-compliance, privacy, age-rating, and review-information fields in App Store Connect.
6. Add the processed build to an internal TestFlight group before external testing or App Review.

The App Store submission also requires a 1024×1024 icon, iPhone screenshots,
support and privacy-policy URLs, an app description, keywords, and review notes.

## App Review readiness

- Deploy the `delete-account` Supabase Edge Function before submission.
- Host `privacy.html` at a stable public URL and use that URL in App Store Connect.
- Provide App Review with a working demo account containing representative chores.
- Complete the App Privacy questionnaire for email address, user ID, and user content.
- Verify account deletion from Account settings using a disposable test account.
- Enable Supabase leaked-password protection and resolve Security Advisor warnings.
- Confirm Supabase row-level security isolates each household before inviting external testers.
