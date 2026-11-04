#!/usr/bin/env python3
"""
Convert ONNX models with external data to single-file format

This script merges .onnx and .onnx.data files into single embedded ONNX files
that work in ONNX Runtime Web (browsers).

Models to convert:
- efficientnet_b4.onnx + efficientnet_b4.onnx.data → efficientnet_b4_embedded.onnx
- xception_net.onnx + xception_net.onnx.data → xception_net_embedded.onnx
- resnet50.onnx + resnet50.onnx.data → resnet50_embedded.onnx
"""

import os
import sys
from pathlib import Path

try:
    import onnx
    from onnx import external_data_helper
except ImportError:
    print("❌ ONNX not installed!")
    print("\nInstall with:")
    print("  pip install onnx")
    sys.exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
MODELS_DIR = PROJECT_ROOT / "public" / "models" / "onnx"

# Models to convert (with external data)
MODELS_TO_CONVERT = [
    {
        'input': 'efficientnet_b4.onnx',
        'output': 'efficientnet_b4_embedded.onnx',
        'data_file': 'efficientnet_b4.onnx.data',
        'size_mb': 67.7
    },
    {
        'input': 'xception_net.onnx',
        'output': 'xception_net_embedded.onnx',
        'data_file': 'xception_net.onnx.data',
        'size_mb': 3.75
    },
    {
        'input': 'resnet50.onnx',
        'output': 'resnet50_embedded.onnx',
        'data_file': 'resnet50.onnx.data',
        'size_mb': 89.6
    }
]

def convert_model(input_path: Path, output_path: Path, data_path: Path):
    """
    Convert ONNX model with external data to single embedded file
    """
    print(f"\n📥 Loading {input_path.name}...")
    print(f"   + {data_path.name}")
    
    # Check files exist
    if not input_path.exists():
        raise FileNotFoundError(f"Model file not found: {input_path}")
    if not data_path.exists():
        raise FileNotFoundError(f"Data file not found: {data_path}")
    
    # Load model with external data
    # Must be in same directory for ONNX to find the .data file
    original_dir = os.getcwd()
    os.chdir(input_path.parent)
    
    try:
        model = onnx.load(str(input_path.name), load_external_data=True)
        print(f"   ✅ Loaded successfully")
        
        # Get model info
        print(f"   Model info:")
        print(f"     - IR version: {model.ir_version}")
        print(f"     - Opset version: {model.opset_import[0].version}")
        print(f"     - Inputs: {len(model.graph.input)}")
        print(f"     - Outputs: {len(model.graph.output)}")
        
        # Save with embedded data (no external files)
        os.chdir(original_dir)
        print(f"\n💾 Saving as single-file model...")
        print(f"   Output: {output_path.name}")
        
        # Remove external data and embed everything
        onnx.save(
            model, 
            str(output_path),
            save_as_external_data=False  # KEY: Embed all data in the model file
        )
        
        # Verify output
        output_size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"   ✅ Saved successfully!")
        print(f"   Size: {output_size_mb:.2f} MB")
        
        # Verify it loads
        print(f"\n🔍 Verifying converted model...")
        test_model = onnx.load(str(output_path))
        onnx.checker.check_model(test_model)
        print(f"   ✅ Model validation passed!")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    finally:
        os.chdir(original_dir)

def main():
    print("=" * 70)
    print("🔄 ONNX Model Converter - External Data → Single File")
    print("=" * 70)
    
    print(f"\n📁 Models directory: {MODELS_DIR}")
    
    if not MODELS_DIR.exists():
        print(f"❌ Models directory not found: {MODELS_DIR}")
        print("\nMake sure you're running this from the project root.")
        sys.exit(1)
    
    print(f"\n📋 Converting {len(MODELS_TO_CONVERT)} models...")
    
    success_count = 0
    failed_models = []
    
    for model_info in MODELS_TO_CONVERT:
        input_path = MODELS_DIR / model_info['input']
        output_path = MODELS_DIR / model_info['output']
        data_path = MODELS_DIR / model_info['data_file']
        
        print("\n" + "-" * 70)
        print(f"🔄 Converting: {model_info['input']}")
        print(f"   Expected output size: ~{model_info['size_mb']:.2f} MB")
        
        try:
            if convert_model(input_path, output_path, data_path):
                success_count += 1
            else:
                failed_models.append(model_info['input'])
        except Exception as e:
            print(f"❌ Failed: {e}")
            failed_models.append(model_info['input'])
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 CONVERSION SUMMARY")
    print("=" * 70)
    print(f"\n✅ Successfully converted: {success_count}/{len(MODELS_TO_CONVERT)}")
    
    if failed_models:
        print(f"❌ Failed: {len(failed_models)}")
        for model in failed_models:
            print(f"   - {model}")
    
    if success_count == len(MODELS_TO_CONVERT):
        print("\n🎉 All models converted successfully!")
        print("\n📝 Next steps:")
        print("1. Upload converted models to Hugging Face:")
        print("   cd public/models/onnx")
        print("   huggingface-cli upload stino214/deepfake-onnx-models efficientnet_b4_embedded.onnx efficientnet_b4_embedded.onnx")
        print("   huggingface-cli upload stino214/deepfake-onnx-models xception_net_embedded.onnx xception_net_embedded.onnx")
        print("   huggingface-cli upload stino214/deepfake-onnx-models resnet50_embedded.onnx resnet50_embedded.onnx")
        print("\n2. Update URLs in src/lib/onnx/onnxDetector.ts")
        print("3. Rebuild and deploy!")
    else:
        print("\n⚠️  Some models failed to convert. Check errors above.")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    main()
