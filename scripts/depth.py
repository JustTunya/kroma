"""One-off: generate a grayscale depth map for the hero image.

    python scripts/depth.py public/kroma_bg.webp public/kroma_bg_depth.webp

Uses Depth-Anything-V2-Small (ONNX). Not part of the app build — run it once
when the hero photo changes, commit the output, then forget about it.

Requires: pip install onnxruntime pillow numpy huggingface_hub truststore
"""

import sys

import numpy as np
import onnxruntime as ort
import truststore
from huggingface_hub import hf_hub_download
from PIL import Image, ImageFilter

truststore.inject_into_ssl()  # certifi misses the local MITM root; use OS certs

REPO = "onnx-community/depth-anything-v2-small"
FILE = "onnx/model.onnx"
SIZE = 518  # model's native input resolution


def depth_map(src: Image.Image) -> Image.Image:
    session = ort.InferenceSession(hf_hub_download(REPO, FILE))

    x = np.asarray(src.resize((SIZE, SIZE), Image.BICUBIC), dtype=np.float32) / 255.0
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)

    d = session.run(None, {session.get_inputs()[0].name: x})[0].squeeze()
    d = (d - d.min()) / (d.max() - d.min())  # near = 1.0, far = 0.0

    out = Image.fromarray((d * 255).astype(np.uint8), mode="L")
    # Soften so the shader's UV displacement doesn't tear on hard depth edges.
    return out.resize(src.size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))


def main(src_path: str, out_path: str) -> None:
    src = Image.open(src_path).convert("RGB")
    out = depth_map(src)
    assert out.size == src.size, f"depth {out.size} != source {src.size}"
    assert out.mode == "L", f"expected grayscale, got {out.mode}"
    extremes = np.asarray(out)
    assert np.ptp(extremes) > 200, f"depth range too flat: {np.ptp(extremes)}"
    out.save(out_path, quality=92, method=6)
    print(f"{out_path} {out.size} range={extremes.min()}-{extremes.max()}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
