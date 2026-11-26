#!/usr/bin/env bash
# UniRig çıkarım ortamı (resmî README adımları + GPU yoksa CPU uyarlaması).
#
#   bash tools/unirig/setup.sh <çalışma_klasörü> [cpu|cuda]
#
# - <çalışma_klasörü>/UniRig      : resmî depo (git clone)
# - <çalışma_klasörü>/unirig-venv : izole Python 3.11 ortamı (sistem Python'una dokunmaz)
# - Hugging Face ağırlıkları ~/.cache/huggingface altına iner (VAST-AI/UniRig).
#
# cuda modu: README'deki gibi torch + spconv-cuXXX + torch_scatter/cluster + flash_attn kurar.
# cpu modu : flash_attn yerine PyTorch SDPA ara katmanı, CPU spconv (bias yaması) ve
#            *_cpu.yaml görev yapılandırmaları (accelerator: cpu, precision: 32, sdpa).
set -euo pipefail
WORK=${1:?çalışma klasörü ver}; MODE=${2:-cpu}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$WORK"; cd "$WORK"
command -v uv >/dev/null || { echo "uv gerekli: https://docs.astral.sh/uv/"; exit 1; }

[ -d UniRig ] || git clone --depth 1 https://github.com/VAST-AI-Research/UniRig
# Örnek GLB'ler Git LFS'te; LFS yoksa işaretçi dosyaları gerçek dosyalarla değiştir.
for f in UniRig/examples/*.glb; do
  if [ "$(stat -c%s "$f")" -lt 1000 ]; then
    curl -sSL -o "$f" "https://media.githubusercontent.com/media/VAST-AI-Research/UniRig/main/examples/$(basename "$f")"
  fi
done

[ -d unirig-venv ] || uv venv -p 3.11 unirig-venv
# shellcheck disable=SC1091
source unirig-venv/bin/activate
uv pip install pip   # launch/*.sh içindeki "pip install psutil" venv'e gitsin, sisteme değil

TORCH=2.5.1
if [ "$MODE" = cuda ]; then
  CU=${CU:-cu121}
  uv pip install torch==$TORCH torchvision==0.20.1 --index-url https://download.pytorch.org/whl/$CU
  uv pip install -r UniRig/requirements.txt
  uv pip install "spconv-${CU}" torch_scatter torch_cluster -f https://data.pyg.org/whl/torch-$TORCH+$CU.html numpy==1.26.4 psutil
  echo "CUDA kurulumu bitti. Resmî betikleri olduğu gibi kullanabilirsin."
else
  uv pip install torch==$TORCH torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
  uv pip install torch_scatter torch_cluster -f https://data.pyg.org/whl/torch-$TORCH+cpu.html
  grep -v flash_attn UniRig/requirements.txt > /tmp/unirig-req-noflash.txt
  uv pip install -r /tmp/unirig-req-noflash.txt spconv numpy==1.26.4 psutil
  SP=$(python -c "import site;print(site.getsitepackages()[0])")
  # 1) flash_attn ara katmanı (aynı parametre adları -> resmî ağırlıklar değişmeden yüklenir)
  mkdir -p "$SP/flash_attn/modules"
  cp "$HERE/flash_attn_init.py" "$SP/flash_attn/__init__.py"
  : > "$SP/flash_attn/modules/__init__.py"
  cp "$HERE/flash_attn_mha.py" "$SP/flash_attn/modules/mha.py"
  # 2) spconv CPU: çıkarımda bias'ı kernel yerine sonradan ekle
  python - "$SP/spconv/pytorch/conv.py" <<'EOF'
import sys
p = sys.argv[1]; s = open(p).read()
a = """        bias_for_training = bias if training else None
        bias_for_infer = bias if not training else None"""
b = """        # CPU patch (UniRig on CPU): CPU kernels can't fuse bias, add it after conv instead.
        _cpu_float = (not features.is_cuda) and not is_int8
        bias_for_training = bias if (training or _cpu_float) else None
        bias_for_infer = bias if (not training and not _cpu_float) else None"""
if "CPU patch (UniRig" not in s:
    assert s.count(a) == 1, "spconv sürümü beklenenden farklı"
    open(p + ".orig", "w").write(s); open(p, "w").write(s.replace(a, b))
print("spconv CPU yaması hazır")
EOF
  # 3) CPU görev yapılandırmaları (resmî dosyalara dokunmadan yanlarına)
  C=UniRig/configs
  sed 's/flash_attention_2/sdpa/' $C/model/unirig_ar_350m_1024_81920_float32.yaml > $C/model/unirig_ar_350m_1024_81920_float32_cpu.yaml
  sed -e 's/unirig_ar_350m_1024_81920_float32$/unirig_ar_350m_1024_81920_float32_cpu/' -e 's/precision: bf16-mixed/precision: 32/' -e 's/accelerator: gpu/accelerator: cpu/' \
    $C/task/quick_inference_skeleton_articulationxl_ar_256.yaml > $C/task/quick_inference_skeleton_articulationxl_ar_256_cpu.yaml
  sed -e 's/precision: bf16-mixed/precision: 32/' -e 's/accelerator: gpu/accelerator: cpu/' \
    $C/task/quick_inference_unirig_skin.yaml > $C/task/quick_inference_unirig_skin_cpu.yaml
  # pyrender (skinning ön işlemesi) başsız EGL ister: Debian/Ubuntu'da libegl1 libegl-mesa0
  python -c "import ctypes.util,sys; sys.exit(0 if ctypes.util.find_library('EGL') else 1)" \
    || echo "UYARI: libEGL yok. Kur: sudo apt-get install -y libegl1 libegl-mesa0"
fi

# Hugging Face ağırlıkları (iskelet + skinning). Depo kökünde, "experiments/" öneki olmadan durur.
python -I -c "
from huggingface_hub import hf_hub_download
for f in ['skeleton/articulation-xl_quantization_256/model.ckpt', 'skin/articulation-xl/model.ckpt']:
    print(hf_hub_download('VAST-AI/UniRig', f))
from transformers import AutoConfig; AutoConfig.from_pretrained('facebook/opt-350m')
"
python -c "import torch, spconv.pytorch, torch_scatter, torch_cluster, bpy, flash_attn; print('hazır: torch', torch.__version__, 'cuda', torch.cuda.is_available(), 'bpy', bpy.app.version_string)"
