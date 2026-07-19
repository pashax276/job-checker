#!/bin/sh
# Generates the self-contained design-sync cssEntry: compiled Tailwind v4
# output plus the font vars next/font injects at app runtime.
set -e
cd "$(dirname "$0")/.."
mkdir -p .design-sync/.cache
.ds-sync/node_modules/.bin/tailwindcss -i .design-sync/tw-input.css -o .design-sync/.cache/tailwind-only.css
cat .design-sync/.cache/tailwind-only.css .design-sync/font-vars.css > .design-sync/.cache/preview-styles.css
