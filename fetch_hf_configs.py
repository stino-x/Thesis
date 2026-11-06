"""
Fetch preprocessor configs from HuggingFace for the ViT models.
This will tell us the correct normalization (ImageNet vs 0.5).
"""

import json

print("="*60)
print("Fetching HuggingFace Model Configs")
print("="*60)

# You need to provide the actual HuggingFace repo IDs
# Check your export scripts or model download logs for these
MODELS_TO_CHECK = {
    'vitDeepfakeExp': None,      # e.g., "dima806/deepfake_vs_real_image_detection"
    'vitDeepfakeV2': None,       # e.g., "another-user/model-name"
    'deepfakeDetector': None,    # e.g., "user/model"
    'aiDetector': None,          # e.g., "microsoft/swinv2-base-patch4-window16-256"
}

print("\nTo fetch configs, I need the HuggingFace repository IDs.")
print("These should be in your model export or download scripts.")
print("\nPlease update MODELS_TO_CHECK in this script with:")
print("  - Where you got vitDeepfakeExp from")
print("  - Where you got vitDeepfakeV2 from")
print("  - Where you got deepfakeDetector from")
print("  - Where you got aiDetector from")

print("\nOnce you have the repo IDs, uncomment and run this:")
print("""
try:
    from huggingface_hub import hf_hub_download
    
    for model_name, repo_id in MODELS_TO_CHECK.items():
        if repo_id is None:
            print(f"\\n⚠️  {model_name}: No repo ID provided")
            continue
            
        try:
            # Try to download preprocessor_config.json
            config_path = hf_hub_download(repo_id, "preprocessor_config.json")
            with open(config_path, 'r') as f:
                config = json.load(f)
            
            print(f"\\n{'='*60}")
            print(f"📄 {model_name} ({repo_id})")
            print(f"{'='*60}")
            
            # Show relevant keys
            for key in ['image_mean', 'image_std', 'size', 'do_normalize', 'do_rescale']:
                if key in config:
                    print(f"  {key}: {config[key]}")
            
            # Determine normalization type
            if 'image_mean' in config and 'image_std' in config:
                mean = config['image_mean']
                std = config['image_std']
                
                if mean == [0.485, 0.456, 0.406] and std == [0.229, 0.224, 0.225]:
                    print("  ✅ Uses ImageNet normalization")
                elif mean == [0.5, 0.5, 0.5] and std == [0.5, 0.5, 0.5]:
                    print("  ⚠️  Uses 0.5 mean/std - NEEDS 'half' mode!")
                else:
                    print(f"  ⚠️  Custom normalization")
                    
        except Exception as e:
            print(f"\\n❌ {model_name}: Could not fetch config")
            print(f"   Error: {e}")
            
        # Also try to get config.json for image_size
        try:
            config_path = hf_hub_download(repo_id, "config.json")
            with open(config_path, 'r') as f:
                config = json.load(f)
            if 'image_size' in config:
                print(f"  Image size: {config['image_size']}")
        except:
            pass
            
except ImportError:
    print("\\n❌ huggingface_hub not installed")
    print("   Run: pip install huggingface_hub")
""")

print("\n" + "="*60)
print("ALTERNATIVE: Manual Check")
print("="*60)
print("\nIf you know the repo IDs, you can check manually:")
print("1. Go to https://huggingface.co/[repo-id]")
print("2. Click 'Files and versions' tab")
print("3. Look for 'preprocessor_config.json' and 'config.json'")
print("4. Check the mean, std, and image_size values")
