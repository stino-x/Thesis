# Research-Grade Features

This document describes the advanced research-grade features implemented in the deepfake detection system.

## Overview

Three advanced features have been integrated to provide research-grade detection capabilities:

1. **Confidence Calibration** - Converts raw model scores to meaningful probabilities
2. **Adversarial Attack Detection** - Identifies attempts to fool the models
3. **Partial Deepfake Localization** - Detects and localizes region-specific manipulations

All features are toggleable via Settings and work across all three detection modes (Image, Video, Webcam).

## 1. Confidence Calibration

### What It Does
Transforms raw model confidence scores into calibrated probabilities using Platt scaling. Raw scores from neural networks don't represent true probabilities - a score of 0.7 doesn't mean 70% probability. Calibration fixes this.

### Implementation
- **File**: `src/lib/calibration/confidenceCalibrator.ts`
- **Method**: Platt scaling (logistic regression on model scores)
- **Ensemble**: Combines multiple model scores with reliability weighting
- **Output**: 
  - Calibrated probability (0-1)
  - 95% confidence interval
  - Reliability score (model agreement)
  - Calibration warnings

### Key Functions
```typescript
calibrateEnsemble(scores: Record<string, number>): CalibrationResult
getConfidenceInterval(probability: number, reliability: number): [number, number]
isWellCalibrated(probability: number, reliability: number): CalibrationCheck
```

### When to Trust Results
- **High reliability (>0.7)**: Models agree, result is trustworthy
- **Medium reliability (0.4-0.7)**: Some disagreement, use caution
- **Low reliability (<0.4)**: Models strongly disagree, result unreliable

### Performance
- Overhead: ~50-100ms per detection
- Memory: Negligible

## 2. Adversarial Attack Detection

### What It Does
Detects adversarial perturbations - small, carefully crafted noise added to images to fool deepfake detectors. These attacks are invisible to humans but can flip detection results.

### Implementation
- **File**: `src/lib/adversarial/adversarialDetector.ts`
- **Detection Methods**:
  1. **High-frequency noise analysis** - Adversarial perturbations concentrate in high frequencies
  2. **Model disagreement** - Adversarial examples cause unusual score patterns
  3. **Multi-modal consistency** - Adversarial attacks typically only fool visual models
  4. **Statistical anomalies** - Unusual pixel value distributions

### Indicators
- High-frequency energy spikes (>0.15)
- Extreme model disagreement (variance >0.3)
- Visual-only manipulation (multi-modal mismatch)
- Suspicious pixel statistics

### Robustness Scoring
- **High (>0.7)**: Multiple model types + multi-modal analysis
- **Medium (0.4-0.7)**: Multiple models of same type
- **Low (<0.4)**: Single model, vulnerable to targeted attacks

### Recommendations
When adversarial attack detected:
1. Re-analyze with different preprocessing
2. Use multi-modal verification
3. Request original source file
4. Apply defensive transformations (JPEG compression, resizing)

### Performance
- Overhead: ~100-200ms per detection
- Memory: ~5MB for FFT analysis

## 3. Partial Deepfake Localization

### What It Does
Detects and localizes region-specific manipulations where only part of the image/frame is fake. Examples:
- Face swap (only face region manipulated)
- Mouth reenactment (only mouth region)
- Eye manipulation
- Background replacement

### Implementation
- **File**: `src/lib/localization/partialDeepfakeDetector.ts`
- **Methods**:
  1. **Facial region analysis** - Separate scores for eyes, nose, mouth, face boundary
  2. **Texture consistency** - Detects texture mismatches between regions
  3. **Lighting consistency** - Identifies inconsistent lighting across face
  4. **Boundary artifacts** - Finds blending artifacts at manipulation boundaries
  5. **Landmark-based analysis** - Uses face mesh to detect localized anomalies

### Detection Types
- `face_swap`: Entire face replaced
- `mouth_reenactment`: Mouth region manipulated
- `eye_manipulation`: Eye region altered
- `partial_face`: Multiple regions manipulated
- `boundary_artifacts`: Blending artifacts detected

### Heatmap Visualization
- Red regions: High manipulation probability
- Yellow regions: Medium suspicion
- Green regions: Likely authentic
- Toggle with "Show Heatmap" button in results panel

### Performance
- Overhead: ~150-300ms per detection
- Memory: ~10MB for region analysis + heatmap

## Integration

### Settings Configuration
All features are controlled via `src/contexts/settings-context.ts`:

```typescript
interface DetectionSettings {
  // ... other settings
  enableCalibration: boolean;           // Default: true
  enableAdversarialDetection: boolean;  // Default: true
  enablePartialDetection: boolean;      // Default: true
}
```

### UI Components

#### Settings Modal
`src/components/SettingsModal.tsx` provides toggles for each feature:
- Confidence Calibration
- Adversarial Attack Detection
- Partial Deepfake Detection

#### Enhanced Results Panel
`src/components/EnhancedResultsPanel.tsx` displays:
- Calibrated confidence with interval
- Adversarial attack warnings
- Partial manipulation details
- Heatmap toggle button

### Detection Integration

All three detector components integrate the features:

#### ImageAnalyzer
```typescript
// After base detection
if (settings.enableCalibration || settings.enableAdversarialDetection || settings.enablePartialDetection) {
  const enhanced = enhanceDetectionResult(
    detectionResult,
    imageData,
    faceBbox,
    faceLandmarks
  );
  setEnhancedResult(enhanced);
}
```

#### WebcamDetector
- Real-time enhancement on each frame
- Heatmap overlay on video canvas
- Live adversarial warnings

#### VideoAnalyzer
- Enhancement on aggregated results
- Uses last frame for visualization
- Temporal consistency with calibration

## Performance Impact

### Total Overhead
- **Calibration only**: +50-100ms
- **Adversarial only**: +100-200ms
- **Partial only**: +150-300ms
- **All enabled**: +250-600ms

### Optimization Strategies
1. **Parallel processing**: All three features run independently
2. **Lazy computation**: Only compute when features enabled
3. **Cached FFT**: Reuse frequency analysis across features
4. **Downsampled regions**: Partial detection uses 224x224 regions

### Memory Usage
- Calibration: <1MB
- Adversarial: ~5MB (FFT buffers)
- Partial: ~10MB (region analysis + heatmap)
- Total: ~15MB additional

## Validation & Testing

### Calibration Validation
Test with known probability distributions:
```typescript
// Should output ~0.7 for 70% fake rate
const scores = { model1: 0.8, model2: 0.6, model3: 0.7 };
const result = calibrateEnsemble(scores);
console.log(result.ensembleProbability); // ~0.7
```

### Adversarial Testing
Test with FGSM/PGD attacked images:
1. Generate adversarial example
2. Run detection
3. Verify `isAdversarial === true`
4. Check indicators include "high_frequency_noise"

### Partial Detection Testing
Test with face-swap deepfakes:
1. Load face-swap image
2. Run detection
3. Verify `hasPartialManipulation === true`
4. Check `manipulationType === 'face_swap'`
5. Verify heatmap highlights face region

## Research Background

### Confidence Calibration
- **Paper**: "On Calibration of Modern Neural Networks" (Guo et al., 2017)
- **Method**: Platt scaling (Platt, 1999)
- **Application**: Ensemble calibration for deepfake detection

### Adversarial Detection
- **Papers**: 
  - "Explaining and Harnessing Adversarial Examples" (Goodfellow et al., 2015)
  - "Detecting Adversarial Examples" (Metzen et al., 2017)
- **Methods**: Frequency analysis, statistical detection

### Partial Deepfake Detection
- **Papers**:
  - "Face X-ray for More General Face Forgery Detection" (Li et al., 2020)
  - "Multi-task Learning For Detecting and Segmenting Manipulated Facial Images" (Nguyen et al., 2019)
- **Methods**: Region-based analysis, boundary detection

## Future Enhancements

### Calibration
- [ ] Temperature scaling for individual models
- [ ] Isotonic regression for non-parametric calibration
- [ ] Bayesian confidence intervals

### Adversarial
- [ ] Defensive distillation
- [ ] Adversarial training integration
- [ ] Certified robustness bounds

### Partial Detection
- [ ] Attention-based localization
- [ ] Temporal consistency for videos
- [ ] 3D face model consistency

## Troubleshooting

### Calibration Issues
**Problem**: Reliability always low
- **Cause**: Models strongly disagree
- **Solution**: Check if image is edge case, try different preprocessing

**Problem**: Wide confidence intervals
- **Cause**: High uncertainty in ensemble
- **Solution**: Normal for ambiguous cases, use multi-modal verification

### Adversarial Issues
**Problem**: False positives on compressed images
- **Cause**: JPEG artifacts trigger frequency detector
- **Solution**: Adjust threshold or disable for low-quality images

**Problem**: Missing targeted attacks
- **Cause**: Sophisticated attacks evade detection
- **Solution**: Use multi-modal analysis, check robustness score

### Partial Detection Issues
**Problem**: No regions detected on obvious face swap
- **Cause**: High-quality swap with good blending
- **Solution**: Check texture/lighting scores, may need lower threshold

**Problem**: Heatmap not showing
- **Cause**: Feature disabled or no partial manipulation detected
- **Solution**: Enable in settings, verify `hasPartialManipulation === true`

## API Reference

See individual library files for detailed API documentation:
- `src/lib/calibration/confidenceCalibrator.ts`
- `src/lib/adversarial/adversarialDetector.ts`
- `src/lib/localization/partialDeepfakeDetector.ts`
- `src/lib/tensorflow/enhancedDetector.ts`
