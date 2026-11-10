import zipfile, random, os, sys

zip_path, out_dir, prefix, n = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
zf = zipfile.ZipFile(zip_path)
names = [x for x in zf.namelist() if x.lower().endswith((".jpg", ".jpeg", ".png"))]
random.seed(1)
os.makedirs(out_dir, exist_ok=True)
for i, name in enumerate(random.sample(names, n)):
    ext = os.path.splitext(name)[1]
    with open(f"{out_dir}/{prefix}_{i:03d}{ext}", "wb") as f:
        f.write(zf.read(name))
