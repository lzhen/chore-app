#!/bin/sh
# Xcode Cloud discovers this directory next to App.xcworkspace / App.xcodeproj.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=${CI_PRIMARY_REPOSITORY_PATH:-$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)}
cd "$REPOSITORY_ROOT"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export HUSKY=0

# Xcode Cloud does not guarantee a Node runtime. Keep development build tools
# installed even when the workflow configures NODE_ENV=production.
if ! command -v node >/dev/null 2>&1 || ! node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit((major===22&&minor>=13)||major>=24?0:1)' >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 || { echo 'error: Node.js 22.13+ or 24+ is required.' >&2; exit 1; }
  brew install node@22
  export PATH="$(brew --prefix node@22)/bin:$PATH"
fi
if ! command -v pod >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 || { echo 'error: CocoaPods is required.' >&2; exit 1; }
  brew install cocoapods
fi
printf '\nPreparing Pawssible Chorely for iOS\n'
node --version
npm --version
pod --version
npm ci --include=dev
CAPACITOR_BUILD=true npm run build
./node_modules/.bin/cap sync ios

# Fail here with a useful message rather than an obscure archive error.
for path in \
  'ios/App/App.xcworkspace/contents.xcworkspacedata' \
  'ios/App/Pods/Pods.xcodeproj/project.pbxproj' \
  'ios/App/Pods/Target Support Files/Pods-App/Pods-App.debug.xcconfig' \
  'ios/App/Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig' \
  'ios/App/App/public/index.html'; do
  test -s "$path" || { echo "error: iOS preparation did not generate $path" >&2; exit 1; }
done
cmp ios/App/Podfile.lock ios/App/Pods/Manifest.lock
printf '\nPawssible Chorely dependencies and bundled web assets are ready.\n'
printf 'Archive the App scheme in ios/App/App.xcworkspace (not App.xcodeproj alone).\n'
