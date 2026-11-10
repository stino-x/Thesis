import os, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
for label in ("real", "fake"):
    os.makedirs(os.path.join(dst, label), exist_ok=True)
    for f in sorted(os.listdir(os.path.join(src, label))):
        im = Image.open(os.path.join(src, label, f)).convert("RGB")
        w, h = im.size
        s = min(w, h)
        l, t = (w - s) // 2, (h - s) // 2
        im = im.crop((l, t, l + s, t + s)).resize((256, 256), Image.LANCZOS)
        im.save(os.path.join(dst, label, os.path.splitext(f)[0] + ".png"))
