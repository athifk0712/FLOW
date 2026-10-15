#!/bin/sh
# Re-renders every app icon from render.html (celengan-ayam mark) with headless Chrome, then sizes them with Pillow.
# Run from the repo root: sh docs/brand/render-icons.sh
set -e
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
ROOT="$(cygpath -m "$(pwd)" 2>/dev/null || pwd)"
TMP="$ROOT/docs/brand/.render"
mkdir -p "$TMP"
for v in icon fg mono splash; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=1024,1024 \
    --screenshot="$TMP/$v.png" "file:///$ROOT/docs/brand/render.html?v=$v" 2>/dev/null
done
python - "$ROOT" "$TMP" <<'PY'
import sys
from PIL import Image
root, tmp = sys.argv[1], sys.argv[2]
img = f'{root}/mobile/assets/images'
icon = Image.open(f'{tmp}/icon.png').convert('RGB')
icon.save(f'{img}/icon.png', optimize=True)
icon.resize((512, 512), Image.LANCZOS).save(f'{root}/docs/play-store/icon-512.png', optimize=True)
icon.resize((256, 256), Image.LANCZOS).save(f'{root}/mobile/public/logo.png', optimize=True)
for name, src in [('android-icon-foreground.png', 'fg'), ('android-icon-monochrome.png', 'mono'), ('splash-icon.png', 'splash')]:
    Image.open(f'{tmp}/{src}.png').convert('RGBA').resize((512, 512), Image.LANCZOS).save(f'{img}/{name}', optimize=True)
Image.open(f'{tmp}/icon.png').convert('RGBA').resize((48, 48), Image.LANCZOS).save(f'{img}/favicon.png', optimize=True)
print('icons written')
PY
rm -rf "$TMP"
