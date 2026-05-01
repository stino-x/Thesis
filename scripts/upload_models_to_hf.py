"""
Upload new ONNX models to Hugging Face repository.
Requires: pip install huggingface_hub
"""

from huggingface_hub import HfApi, login
import os
from pathlib import Path

# Configuration
REPO_ID = "stino214/deepfake-onnx-models"
LOCAL_MODEL_DIR = Path("../public/models/onnx")

# Models to upload (new ones only)
NEW_MODELS = [
    "efficientnet_b4.onnx",
    "efficientnet_b4.onnx.data",
    "xception_net.onnx",
    "xception_net.onnx.data",
    "resnet50.onnx",
    "resnet50.onnx.data",
]

def upload_models():
    """Upload new models to Hugging Face."""
    
    # Login (will use HF_TOKEN environment variable or prompt)
    print("🔐 Logging in to Hugging Face...")
    try:
        login()
    except Exception as e:
        print(f"⚠️  Login failed: {e}")
        print("Please set HF_TOKEN environment variable or run 'huggingface-cli login'")
        return
    
    api = HfApi()
    
    # Upload each model
    for model_file in NEW_MODELS:
        local_path = LOCAL_MODEL_DIR / model_file
        
        if not local_path.exists():
            print(f"⚠️  Skipping {model_file} (not found locally)")
            continue
        
        size_mb = local_path.stat().st_size / (1024 * 1024)
        print(f"\n📤 Uploading {model_file} ({size_mb:.2f} MB)...")
        
        try:
            api.upload_file(
                path_or_fileobj=str(local_path),
                path_in_repo=model_file,
                repo_id=REPO_ID,
                repo_type="model",
            )
            print(f"✅ Uploaded {model_file}")
        except Exception as e:
            print(f"❌ Failed to upload {model_file}: {e}")
    
    print("\n✅ Upload complete!")
    print(f"🔗 View at: https://huggingface.co/{REPO_ID}")

if __name__ == "__main__":
    upload_models()
