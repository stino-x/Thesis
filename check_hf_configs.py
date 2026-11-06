"""
Check if HuggingFace model configs exist and show their preprocessing settings.
This helps verify the correct normalization for ViT models.
"""

from pathlib import Path
import json

# Common locations where HF models might be cached
POSSIBLE_LOCATIONS = [
    Path.home() / ".cache" / "huggingface" / "hub",
    Path("models"),  # Local models directory
    Path("scripts") / "cache",  # Script cache
]

def find_config_files():
    """Search for preprocessor_config.json files."""
    configs = []
    
    for base_path in POSSIBLE_LOCATIONS:
        if not base_path.exists():
            continue
        
        # Search recursively for preprocessor_config.json
        for config_file in base_path.rglob("preprocessor_config.json"):
            configs.append(config_file)
    
    return configs

def check_config(config_path):
    """Read and display preprocessing config."""
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        print(f"\n📄 {config_path.parent.name}")
        print(f"   Path: {config_path}")
        
        # Key fields for preprocessing
        interesting_keys = [
            'image_mean', 'image_std',
            'do_normalize', 'do_rescale',
            'rescale_factor', 'size',
            'crop_size', 'do_resize'
        ]
        
        has_info = False
        for key in interesting_keys:
            if key in config:
                print(f"   {key}: {config[key]}")
                has_info = True
        
        if not has_info:
            print("   (No normalization info found)")
        
        # Determine normalization type
        if 'image_mean' in config and 'image_std' in config:
            mean = config['image_mean']
            std = config['image_std']
            
            # Check if it's ImageNet normalization
            imagenet_mean = [0.485, 0.456, 0.406]
            imagenet_std = [0.229, 0.224, 0.225]
            
            # Check if it's 0.5 normalization
            half_mean = [0.5, 0.5, 0.5]
            half_std = [0.5, 0.5, 0.5]
            
            if mean == imagenet_mean and std == imagenet_std:
                print("   ✅ Uses ImageNet normalization")
            elif mean == half_mean and std == half_std:
                print("   ⚠️  Uses 0.5 mean/std - NEEDS 'half' mode in code!")
            else:
                print(f"   ⚠️  Custom normalization - verify against export script")
        
        return config
        
    except Exception as e:
        print(f"   ❌ Error reading config: {e}")
        return None

def main():
    print("="*60)
    print("🔍 Searching for HuggingFace Model Configs")
    print("="*60)
    
    # Search for configs
    configs = find_config_files()
    
    if not configs:
        print("\n❌ No preprocessor_config.json files found in:")
        for loc in POSSIBLE_LOCATIONS:
            print(f"   {loc}")
        
        print("\n💡 This means:")
        print("   1. You exported models without keeping the original HF configs")
        print("   2. OR the models are in a different location")
        
        print("\n📝 To find the correct normalization:")
        print("   1. Check your model export script")
        print("   2. Look at the HuggingFace model card")
        print("   3. Test with both ImageNet and 0.5 normalization")
        
        print("\n🔗 If you downloaded from HuggingFace, the model cards are:")
        print("   vitDeepfakeExp:    (provide the HF repo name)")
        print("   vitDeepfakeV2:     (provide the HF repo name)")
        print("   deepfakeDetector:  (provide the HF repo name)")
        
        return
    
    print(f"\n✅ Found {len(configs)} config file(s)")
    
    # Check each config
    for config_path in configs:
        check_config(config_path)
    
    print(f"\n{'='*60}")
    print("📋 SUMMARY")
    print(f"{'='*60}")
    
    print("\nIf any models use [0.5, 0.5, 0.5] normalization:")
    print("  1. Update MODEL_INPUT in src/lib/onnx/onnxDetector.ts:")
    print("     vitDeepfakeExp: { size: 224, norm: 'half' as const },")
    print()
    print("  2. Add 'half' case to canvasToTensor function:")
    print("""
  else if (normalize === 'half') {
    for (let i = 0; i < size * size; i++) {
      float32[i]                   = (data[i * 4]     / 255 - 0.5) / 0.5;
      float32[size * size + i]     = (data[i * 4 + 1] / 255 - 0.5) / 0.5;
      float32[size * size * 2 + i] = (data[i * 4 + 2] / 255 - 0.5) / 0.5;
    }
  }
    """)
    
    print("  3. Update the type:")
    print("     norm: 'imagenet' | 'range1' | 'half'")

if __name__ == "__main__":
    main()
