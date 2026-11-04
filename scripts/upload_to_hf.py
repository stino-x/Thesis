#!/usr/bin/env python3
"""
Upload converted ONNX models to Hugging Face Hub
"""
import os
from pathlib import Path
from huggingface_hub import HfApi, login

# Configuration
REPO_ID = "stino214/deepfake-onnx-models"
MODELS_DIR = Path(__file__).parent.parent / "public" / "models" / "onnx"

# Models to upload
MODELS_TO_UPLOAD = [
    "efficientnet_b4_embedded.onnx",
    "xception_net_embedded.onnx",
    "resnet50_embedded.onnx"
]

def main():
    print("=" * 70)
    print("🚀 Uploading ONNX Models to Hugging Face")
    print("=" * 70)
    print(f"📦 Repository: {REPO_ID}")
    print(f"📁 Source directory: {MODELS_DIR}")
    print()
    
    # Login to Hugging Face
    print("🔐 Logging in to Hugging Face...")
    print("Please enter your Hugging Face token:")
    print("(Get it from: https://huggingface.co/settings/tokens)")
    print()
    
    try:
        login()
        print("✅ Login successful!")
        print()
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return
    
    # Initialize API
    api = HfApi()
    
    # Upload each model
    success_count = 0
    for model_name in MODELS_TO_UPLOAD:
        model_path = MODELS_DIR / model_name
        
        print("-" * 70)
        print(f"📤 Uploading: {model_name}")
        
        if not model_path.exists():
            print(f"❌ File not found: {model_path}")
            continue
        
        file_size_mb = model_path.stat().st_size / (1024 * 1024)
        print(f"   Size: {file_size_mb:.2f} MB")
        
        try:
            api.upload_file(
                path_or_fileobj=str(model_path),
                path_in_repo=model_name,
                repo_id=REPO_ID,
                repo_type="model",
            )
            print(f"✅ Upload successful!")
            success_count += 1
        except Exception as e:
            print(f"❌ Upload failed: {e}")
    
    print("=" * 70)
    print(f"📊 UPLOAD SUMMARY")
    print("=" * 70)
    print(f"✅ Successfully uploaded: {success_count}/{len(MODELS_TO_UPLOAD)}")
    
    if success_count == len(MODELS_TO_UPLOAD):
        print("🎉 All models uploaded successfully!")
        print()
        print("📝 Next steps:")
        print("1. Update MODEL_URLS in src/lib/onnx/onnxDetector.ts")
        print("2. Re-enable the 3 models in detectWithOnnx()")
        print("3. Rebuild and deploy!")
    else:
        print("⚠️  Some uploads failed. Please check errors above.")
    print("=" * 70)

if __name__ == "__main__":
    main()
