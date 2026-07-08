#!/bin/bash
# Creates the "OpenClaw UI" double-clickable app and a Desktop shortcut to it.
# The app itself lives in ~/Applications: on Macs with iCloud "Desktop &
# Documents" sync, app bundles stored on the Desktop can be evicted to the
# cloud, which breaks launching (and even deleting) them. The Desktop gets a
# symlink instead, which is safe to sync.
# Usage: scripts/create-desktop-shortcut.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$HOME/Applications"
APP="$APP_DIR/OpenClaw UI.app"
LINK="$HOME/Desktop/OpenClaw UI"

mkdir -p "$APP_DIR"
rm -rf "$APP"
osacompile -o "$APP" -e "do shell script \"'$REPO/scripts/launch.sh' >/dev/null 2>&1\""

# Best-effort 🦞 icon: render the emoji with AppKit, build an .icns, swap it in.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if command -v swift >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  cat >"$TMP/render.swift" <<'EOF'
import AppKit
let size: CGFloat = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
let str = "🦞" as NSString
let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 820)]
let s = str.size(withAttributes: attrs)
str.draw(at: NSPoint(x: (size - s.width) / 2, y: (size - s.height) / 2), withAttributes: attrs)
image.unlockFocus()
guard let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else { exit(1) }
try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
EOF
  if swift "$TMP/render.swift" "$TMP/base.png" 2>/dev/null; then
    mkdir -p "$TMP/icon.iconset"
    for s in 16 32 128 256 512; do
      sips -z "$s" "$s" "$TMP/base.png" --out "$TMP/icon.iconset/icon_${s}x${s}.png" >/dev/null
      sips -z "$((s * 2))" "$((s * 2))" "$TMP/base.png" --out "$TMP/icon.iconset/icon_${s}x${s}@2x.png" >/dev/null
    done
    if iconutil -c icns "$TMP/icon.iconset" -o "$TMP/applet.icns" 2>/dev/null; then
      cp "$TMP/applet.icns" "$APP/Contents/Resources/applet.icns"
      touch "$APP"
    fi
  fi
fi

echo "Created: $APP"
if ln -sfn "$APP" "$LINK" 2>/dev/null; then
  echo "Desktop shortcut: $LINK"
else
  echo "Could not write to the Desktop (macOS privacy protection)."
  echo "Open ~/Applications in Finder and drag 'OpenClaw UI' to your Desktop or Dock."
fi
echo "Double-click it to start OpenClaw UI. Server logs: ~/Library/Logs/openclaw-ui.log"
