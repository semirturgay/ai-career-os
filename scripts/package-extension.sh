#!/usr/bin/env bash
# Build a store-ready extension zip.
#
# extension/app/ is the compiled side panel and is gitignored, so zipping the
# extension directory straight from a fresh clone produces a package that installs
# and then shows a blank panel. This always rebuilds it first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")"
OUT_DIR="dist"
STAGE="$OUT_DIR/extension"
ZIP="$OUT_DIR/ai-career-os-extension-v$VERSION.zip"

echo "Building side panel…"
(cd frontend && bun run build:extension >/dev/null)

if [ ! -f extension/app/index.html ]; then
  echo "error: extension/app/index.html missing after build" >&2
  exit 1
fi

echo "Staging…"
rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE"
# Ship only what the extension loads at runtime. README and design notes are for the
# repo, not the package — every extra file is another thing review has to look at.
for item in manifest.json background.js icons app content options shared; do
  [ -e "extension/$item" ] && cp -R "extension/$item" "$STAGE/"
done
find "$STAGE" -name ".DS_Store" -delete

echo "Zipping…"
(cd "$STAGE" && zip -qr "../../$ZIP" .)

SIZE="$(du -h "$ZIP" | cut -f1)"
echo
echo "  $ZIP  ($SIZE)"
echo
echo "Contents:"
# -Z1 lists bare names and is portable across the BSD and Info-ZIP builds
unzip -Z1 "$ZIP" | grep -v '/$' | sed 's/^/    /' | head -20
echo
echo "Load unpacked from $STAGE to test the exact contents before uploading."
