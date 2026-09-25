#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=${CI_PRIMARY_REPOSITORY_PATH:-$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)}
export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
CONFIG="$REPOSITORY_ROOT/ios/App/Pods/Target Support Files/Pods-App/Pods-App.release.xcconfig"
if [ ! -s "$CONFIG" ]; then
  echo 'error: CocoaPods dependencies are missing. The post-clone hook in ios/App/ci_scripts must run successfully before Archive.' >&2
  exit 1
fi
test -s "$REPOSITORY_ROOT/ios/App/App/public/index.html"
node "$SCRIPT_DIR/verify_deployment_targets.mjs"
echo 'Pawssible Chorely pre-archive check passed.'
