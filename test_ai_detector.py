"""
Test script to verify ai_detector_int8.onnx with ONNX Runtime in Python.
This helps diagnose whether the model export is broken or if it's a browser-specific issue.
"""

import onnxruntime as ort
import numpy as np

# Path to the model
model_path = "public/models/onnx/ai_detector_int8.onnx"

try:
    print("Loading ai_detector_int8.onnx...")
    session = ort.InferenceSession(model_path)
    
    # Print input info
    input_info = session.get_inputs()[0]
    print(f"\nInput name: {input_info.name}")
    print(f"Input shape: {input_info.shape}")
    print(f"Input type: {input_info.type}")
    
    # Print output info
    output_info = session.get_outputs()[0]
    print(f"\nOutput name: {output_info.name}")
    print(f"Output shape: {output_info.shape}")
    print(f"Output type: {output_info.type}")
    
    # Test with random input matching expected shape [1, 3, 224, 224]
    print("\nRunning inference with random [1, 3, 224, 224] input...")
    random_input = np.random.randn(1, 3, 224, 224).astype(np.float32)
    
    output = session.run(None, {input_info.name: random_input})
    
    print(f"✅ Inference successful!")
    print(f"Output shape: {output[0].shape}")
    print(f"Output values: {output[0]}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("DIAGNOSIS:")
print("="*60)
print("If this script fails with the same shape error, the ONNX export is broken.")
print("Solution: Re-export with fixed input size, use fp32 weights first.")
print("\nIf this script succeeds but the browser fails:")
print("- Try the fp32 version instead of int8")
print("- The issue is in the WASM runtime or quantized op support")
print("="*60)
