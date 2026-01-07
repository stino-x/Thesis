# MesoNet Model Setup

## Quick Download Links

Since MesoNet requires training or downloading pre-trained weights, here are your options:

### Option 1: Use Pre-converted TensorFlow.js Model (Fastest)

I'll provide a lightweight alternative using TensorFlow.js directly.

### Option 2: Train MesoNet Yourself

```bash
# Clone MesoNet repository
git clone https://github.com/DariusAf/MesoNet
cd MesoNet

# Install dependencies
pip install tensorflow keras

# Download FaceForensics++ dataset (optional, for training)
# Or use their pre-trained weights if available

# Convert to TensorFlow.js
pip install tensorflowjs
tensorflowjs_converter \
  --input_format keras \
  weights/Meso4_DF.h5 \
  ../../../public/models/mesonet/
```

### Option 3: Use MobileNetV2 Transfer Learning (Alternative)

Since MesoNet pre-trained weights may not be readily available, we can use MobileNetV2 fine-tuned for deepfake detection:

```javascript
// Load MobileNetV2 base
const mobilenet = await tf.loadLayersModel(
  'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1',
  { fromTFHub: true }
);

// Fine-tune for deepfake detection
// (You would need to train the last layers on deepfake data)
```

## Temporary Solution

For now, I've implemented an enhanced feature-based detector that doesn't require external model files. This will work immediately while you:

1. Train/obtain MesoNet weights
2. Or use the alternative implementation I'll provide

## Model Files (When Ready)

Place model files here:
```
public/
└── models/
    └── mesonet/
        ├── model.json
        └── group1-shard1of1.bin
```

Or for MobileNet alternative:
```
public/
└── models/
    └── mobilenet-deepfake/
        ├── model.json
        └── weights files
```
