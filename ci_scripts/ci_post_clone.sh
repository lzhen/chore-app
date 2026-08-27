#!/bin/sh

set -eu

cd "$CI_PRIMARY_REPOSITORY_PATH"

npm ci
CAPACITOR_BUILD=true npm run build
npx cap sync ios
