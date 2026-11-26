#!/usr/bin/env bash
# Bir 3D modeli UniRig ile iskeletle + skinle, dokulu modele birleştir, doğrula ve
# YAŞAM. simülasyonuna ekle.
#
#   bash tools/unirig/rig.sh <çalışma_klasörü> <girdi.glb|obj|fbx> <ad> [cpu|cuda] [seed]
#
# Çıktı: games/yasam/models/<ad>.glb (web için dokuları 1024 px'e küçültülmüş)
#        <çalışma_klasörü>/UniRig/results/<ad>_rigged.glb (tam çözünürlük)
set -euo pipefail
WORK=$(cd "${1:?çalışma klasörü}" && pwd); IN=$(realpath "${2:?girdi modeli}"); NAME=${3:?ad}; MODE=${4:-cpu}; SEED=${5:-12345}
REPO=$(cd "$(dirname "$0")/../.." && pwd); HERE="$REPO/tools/unirig"
SUF=""; [ "$MODE" = cpu ] && SUF="_cpu"
cd "$WORK/UniRig"
# shellcheck disable=SC1091
source ../unirig-venv/bin/activate
mkdir -p results
EXT="${IN##*.}"; cp "$IN" "results/${NAME}_input.$EXT"
echo "[1/4] iskelet tahmini"
bash launch/inference/generate_skeleton.sh --input "results/${NAME}_input.$EXT" --output "results/${NAME}_skeleton.fbx" --seed "$SEED" \
  --skeleton_task "configs/task/quick_inference_skeleton_articulationxl_ar_256$SUF.yaml" > "results/${NAME}_skeleton.log" 2>&1
test -s "results/${NAME}_skeleton.fbx" || { tail -20 "results/${NAME}_skeleton.log"; exit 1; }
echo "[2/4] skinning ağırlıkları"
bash launch/inference/generate_skin.sh --input "results/${NAME}_skeleton.fbx" --output "results/${NAME}_skin.fbx" \
  --skin_task "configs/task/quick_inference_unirig_skin$SUF.yaml" > "results/${NAME}_skin.log" 2>&1
test -s "results/${NAME}_skin.fbx" || { tail -20 "results/${NAME}_skin.log"; exit 1; }
echo "[3/4] dokulu modelle birleştirme"
bash launch/inference/merge.sh --source "results/${NAME}_skin.fbx" --target "results/${NAME}_input.$EXT" --output "results/${NAME}_rigged.glb" > "results/${NAME}_merge.log" 2>&1
test -s "results/${NAME}_rigged.glb" || { tail -20 "results/${NAME}_merge.log"; exit 1; }
echo "[4/4] doğrulama + web sürümü"
python -I "$HERE/verify_glb.py" "results/${NAME}_rigged.glb"
mkdir -p "$REPO/games/yasam/models"
python -I "$HERE/shrink_glb.py" "results/${NAME}_rigged.glb" "$REPO/games/yasam/models/${NAME}.glb" 1024
python -I "$HERE/verify_glb.py" "$REPO/games/yasam/models/${NAME}.glb" | tail -1
echo "Hazır: $WORK/UniRig/results/${NAME}_rigged.glb  ->  games/yasam/models/${NAME}.glb"
