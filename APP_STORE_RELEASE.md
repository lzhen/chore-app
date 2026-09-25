# Pawssible Chorely — existing App Store release

- App Store Connect app: **Pawssible Chorely**, ID `6805738533`.
- Existing Bundle ID: `com.pawssible.chorely`.
- Existing Xcode Cloud workflow: **Chorely TestFlight**.
- Current Xcode marketing version: `1.0`; Xcode Cloud manages its build number.
- Existing application: https://appstoreconnect.apple.com/apps/6805738533

Do not create another app record or use Empathie Care source code for this release.

## Fix the existing Xcode Cloud archive failure

The previously observed Build 16 failure was missing `Pods-App.release.xcconfig`.
The dependency hook was in repository-root `ci_scripts/`, not beside the nested
Xcode workspace. The executable hook is now at
`ios/App/ci_scripts/ci_post_clone.sh`. It installs Node when needed, installs the
locked npm dependencies, builds native web assets, runs Capacitor / CocoaPods
sync, then checks that both Pods configuration files and bundled resources exist.
The adjacent pre-xcodebuild hook fails early if dependency preparation is absent.

In the existing Xcode Cloud workflow, verify:

- Workspace: `ios/App/App.xcworkspace` (includes CocoaPods), not `.xcodeproj` alone.
- Scheme: `App`.
- Branch: `main`.
- Archive configuration: `Release`, iOS, current supported Xcode SDK.
- Distribution: TestFlight and App Store. Do not use a TestFlight-internal-only
  build when the intent is to submit that build for App Review.
- Keep the existing Apple signing team and app identity.

Start a build from the newest main commit. Build 16 is a historical failed build;
rebuilding that old commit would not include this fix. A GitHub Release Check
verifies an unsigned device archive, not Apple signing, upload, or App Review.

## Local Xcode alternative

Clone/open the existing `lzhen/chore-app` repository. From its root:

```sh
./ios/App/ci_scripts/ci_post_clone.sh
open ios/App/App.xcworkspace
```

Select the App target, the existing Apple Developer team, automatic signing,
and a generic iOS device destination. Product → Archive → Distribute App →
App Store Connect. Do not run `cap add ios` again on the existing project.

## Submission after the build is processed

Select the processed build on the app's Distribution version page. Supply the
required screenshots, description, keywords, support/privacy URLs, age-rating,
App Privacy, export-compliance answers and review access. Add for Review, then
Submit for Review. Uploading a build, adding it for review, and releasing on the
public App Store are distinct steps.

## App Review readiness — still verify before public submission

- Deploy and verify the existing delete-account backend with a disposable account.
- Confirm privacy.html is hosted at the intended public privacy URL.
- Supply App Review with a working demo account and representative chores.
- Verify household data isolation and the actual App Privacy answers.
- Test login, calendar/chores, rewards and account deletion on an iPhone.
- Confirm the version, availability, pricing and release method in App Store Connect.

No passwords, signing private keys, API keys or review credentials belong in this
public repository. The CI verification workflow does not upload or submit apps.

Apple documentation:
https://developer.apple.com/documentation/xcode/writing-custom-build-scripts
https://developer.apple.com/documentation/xcode/making-dependencies-available-to-xcode-cloud
https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app
