"""
Test aiDetector with different input sizes to find the correct one.
SwinV2 models often need sizes divisible by window size (16).
"""

import onnxruntime as ort
import numpy as np

model_path = "public/models/onnx/ai_detector_int8.onnx"

print("Testing aiDetector with different input sizes...")
print("="*60)

try:
    session = ort.InferenceSession(model_path)
    input_name = session.get_inputs()[0].name
    
    # Test common sizes for SwinV2-window16 models
    test_sizes = [224, 256, 384, 512]
    
    for size in test_sizes:
        try:
            input_data = np.random.randn(1, 3, size, size).astype(np.float32)
            output = session.run(None, {input_name: input_data})[0]
            print(f"✅ {size:3d}×{size:3d} OK - Output shape: {output.shape}, Values: {output}")
        except Exception as e:
            error_msg = str(e)
            # Truncate long error messages
            if len(error_msg) > 140:
                error_msg = error_msg[:140] + "..."
            print(f"❌ {size:3d}×{size:3d} FAIL - {error_msg}")
    
    print("\n" + "="*60)
    print("CONCLUSION:")
    print("="*60)
    print("If 256 passes: Set aiDetector: { size: 256, norm: 'imagenet' } in MODEL_INPUT")
    print("If 384 passes: Set aiDetector: { size: 384, norm: 'imagenet' } in MODEL_INPUT")
    print("If nothing passes: The model needs to be re-exported with correct shapes")
    
except Exception as e:
    print(f"Error loading model: {e}")
