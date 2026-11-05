#!/usr/bin/env bash
# Compila o firmware e publica o .uf2 em web/firmware/ com o manifest atualizado.
# Uso: PICO_SDK_PATH=/caminho/pico-sdk tools/release-firmware.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FW="$ROOT/firmware"
OUT="$ROOT/web/firmware"

: "${PICO_SDK_PATH:?Defina PICO_SDK_PATH (ver docs/firmware.md)}"

VERSION="$(sed -n 's/^#define HB1_FW_VERSION "\(.*\)"/\1/p' "$FW/src/config.h")"
[ -n "$VERSION" ] || { echo "HB1_FW_VERSION não encontrado em config.h" >&2; exit 1; }

cmake -S "$FW" -B "$FW/build" -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build "$FW/build" -j"$(nproc 2>/dev/null || echo 4)"

FILE="hb1-$VERSION.uf2"
mkdir -p "$OUT"
cp "$FW/build/hb1.uf2" "$OUT/$FILE"
SHA="$(sha256sum "$OUT/$FILE" | cut -d' ' -f1)"
SIZE="$(stat -c %s "$OUT/$FILE")"
DATE="$(date -u +%Y-%m-%d)"

cat > "$OUT/manifest.json" <<EOF
{
  "product": "HB-1",
  "latest": {
    "version": "$VERSION",
    "file": "$FILE",
    "sha256": "$SHA",
    "size": $SIZE,
    "date": "$DATE"
  }
}
EOF

echo "Firmware $VERSION publicado em web/firmware/$FILE"
echo "sha256 $SHA"
