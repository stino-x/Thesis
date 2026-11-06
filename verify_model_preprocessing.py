"""
Verify ONNX model preprocessing requirements.
Checks input shapes and provides normalization recommendations.
"""

import onnx
from pathlib import Path
import sys

# Model paths
MODELS = {
    'vitDeepfakeExp': 'public/models/onnx/vit_deepfake_exp.onnx',
    'vitDeepfakeV2': 'public/models/onnx/vit_deepfake_v2.onnx',
    'deepfakeDetector': 'public/models/onnx/deepfake_detector.onnx',
    'aiDetector': 'public/models/onnx/ai_detector_int8.onnx',
    'efficientnetB4': 'public/models/onnx/efficientnet_b4_embedded.onnx',
    'xceptionNet': 'public/models/onnx/xception_net_embedded.onnx',
    'resnet50': 'public/models/onnx/resnet50_embedded.onnx',
}

def check_model(name, path_str):
    """Check a single ONNX model's input requirements."""
    path = Path(path_str)
    
    if not path.exists():
        print(f"\n❌ {name}: File not found at {path}")
        return None
    
    try:
        model = onnx.load(str(path))
        graph = model.graph
        
        # Get input info
        input_info = graph.input[0]
        input_name = input_info.name
        input_shape = [dim.dim_value if dim.dim_value > 0 else 'dynamic' 
                       for dim in input_info.type.tensor_type.shape.dim]
        
        # Get output info
        output_info = graph.output[0]
        output_shape = [dim.dim_value if dim.dim_value > 0 else 'dynamic'
                        for dim in output_info.type.tensor_type.shape.dim]
        
        print(f"\n{'='*60}")
        print(f"📊 {name}")
        print(f"{'='*60}")
        print(f"File: {path}")
        print(f"Size: {path.stat().st_size / 1024 / 1024:.1f} MB")
        print(f"\nInput:")
        print(f"  Name: {input_name}")
        print(f"  Shape: {input_shape}")
        
        print(f"\nOutput:")
        print(f"  Name: {output_info.name}")
        print(f"  Shape: {output_shape}")
        
        # Analyze input shape
        if len(input_shape) >= 4:
            batch, channels, height, width = input_shape[:4]
            print(f"\n✅ Detected: [batch={batch}, channels={channels}, H={height}, W={width}]")
            
            # Check if matches current config
            current_config = {
                'vitDeepfakeExp': 224,
                'vitDeepfakeV2': 224,
                'deepfakeDetector': 224,
                'aiDetector': 224,
                'efficientnetB4': 380,
                'xceptionNet': 299,
                'resnet50': 224,
            }
            
            expected = current_config.get(name, 224)
            if height == expected and width == expected:
                print(f"✅ Matches current config ({expected}×{expected})")
            else:
                print(f"⚠️  MISMATCH: Current config expects {expected}×{expected}")
                print(f"   Update MODEL_INPUT in onnxDetector.ts to use size: {height}")
        
        # Normalization hints
        print(f"\n💡 Preprocessing hints:")
        
        # Check metadata for preprocessing info
        has_preprocessing_info = False
        for metadata in model.metadata_props:
            if 'mean' in metadata.key.lower() or 'std' in metadata.key.lower():
                print(f"  Found in metadata: {metadata.key} = {metadata.value}")
                has_preprocessing_info = True
        
        if not has_preprocessing_info:
            print("  No preprocessing metadata found in ONNX file")
            
            # Give recommendations based on model name
            if 'vit' in name.lower():
                print("  ⚠️  ViT models often use:")
                print("     - ImageNet: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]")
                print("     - OR Half: mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]")
                print("  📝 Check preprocessor_config.json from original HuggingFace model")
            
            elif 'xception' in name.lower():
                print("  ⚠️  Xception typically uses:")
                print("     - Range [-1, 1]: (pixel/255 - 0.5) / 0.5")
                print("  📝 Verify against your export script")
            
            elif 'efficientnet' in name.lower():
                print("  ⚠️  EfficientNet can use:")
                print("     - ImageNet normalization (if from torchvision)")
                print("     - OR 0-255 input (if Keras with built-in rescaling)")
                print("  📝 Check your export script and weights source")
            
            elif 'resnet' in name.lower():
                print("  ✅ ResNet50 typically uses:")
                print("     - ImageNet: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]")
        
        return {
            'name': name,
            'input_shape': input_shape,
            'output_shape': output_shape,
            'size_mb': path.stat().st_size / 1024 / 1024
        }
        
    except Exception as e:
        print(f"\n❌ {name}: Error reading ONNX file")
        print(f"   {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("="*60)
    print("🔍 ONNX Model Preprocessing Verification")
    print("="*60)
    
    results = {}
    for name, path in MODELS.items():
        result = check_model(name, path)
        if result:
            results[name] = result
    
    # Summary
    print(f"\n{'='*60}")
    print("📋 SUMMARY")
    print(f"{'='*60}")
    
    print("\n✅ Models found and analyzed:")
    for name, info in results.items():
        input_shape = info['input_shape']
        if len(input_shape) >= 4:
            h, w = input_shape[2], input_shape[3]
            if isinstance(h, str) or isinstance(w, str):
                print(f"  {name:20s} {str(h):>3s}×{str(w):<3s}  ({info['size_mb']:.1f} MB)")
            else:
                print(f"  {name:20s} {h:3d}×{w:3d}  ({info['size_mb']:.1f} MB)")
        else:
            print(f"  {name:20s} (shape info unavailable)  ({info['size_mb']:.1f} MB)")
    
    missing = set(MODELS.keys()) - set(results.keys())
    if missing:
        print("\n❌ Models missing or failed:")
        for name in missing:
            print(f"  {name}")
    
    print(f"\n{'='*60}")
    print("📝 NEXT STEPS")
    print(f"={'='*60}")
    print("\n1. For ViT models (vitDeepfakeExp, vitDeepfakeV2, deepfakeDetector):")
    print("   - Find their original HuggingFace repo")
    print("   - Check preprocessor_config.json for image_mean and image_std")
    print("   - If [0.5, 0.5, 0.5], add 'half' normalization mode")
    
    print("\n2. Run the aiDetector test:")
    print("   python test_ai_detector.py")
    
    print("\n3. Verify your export scripts match these requirements")
    
    print("\n4. If any input size mismatches found, update MODEL_INPUT in:")
    print("   src/lib/onnx/onnxDetector.ts")

if __name__ == "__main__":
    try:
        import onnx
    except ImportError:
        print("❌ onnx package not installed")
        print("\nInstall it with:")
        print("  pip install onnx")
        sys.exit(1)
    
    main()
