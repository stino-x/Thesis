# Quick Start Guide - Research-Grade Features

## Testing the New Features

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Access the Application
Open http://localhost:5173 in your browser

### 3. Enable Research-Grade Features

1. Click the **Settings** icon (gear) in the top right
2. Scroll to "Research-Grade Features" section
3. Ensure these are enabled (they're on by default):
   - ✅ Confidence Calibration
   - ✅ Adversarial Attack Detection
   - ✅ Partial Deepfake Detection

### 4. Test Image Analysis

1. Go to **Detection** page
2. Click **Image** tab
3. Upload a test image (or drag & drop)
4. Click **Analyze Image**
5. Look for the new "Enhanced Results" section below the main results

**What to Look For:**
- **Calibrated Confidence** card showing probability with confidence interval
- **Adversarial Attack Detection** card showing robustness level
- **Localized Manipulation** card (if partial deepfake detected)
- **Heatmap overlay** on the image (toggle with "Show Heatmap" button)

### 5. Test Webcam Detection

1. Go to **Detection** page
2. Click **Webcam** tab
3. Click **Start Webcam** (allow camera permissions)
4. Position your face in view
5. Scroll down to see **Enhanced Results** panel updating in real-time

**What to Look For:**
- Real-time calibrated confidence updates
- Adversarial robustness scoring
- Live heatmap overlay on video (if enabled)

### 6. Test Video Analysis

1. Go to **Detection** page
2. Click **Video** tab
3. Upload a test video
4. Click **Analyze Video**
5. Wait for analysis to complete
6. Check **Enhanced Results** panel in the results

**What to Look For:**
- Aggregated calibrated confidence for entire video
- Adversarial attack warnings
- Partial manipulation detection across frames

## Understanding the Results

### Calibrated Confidence
```
Probability: 87.3%
95% Confidence Interval: 82.1% - 92.5%
Reliability: 85%
```
- **Probability**: Calibrated likelihood of being a deepfake
- **Confidence Interval**: Range where true probability likely falls
- **Reliability**: How much models agree (higher = more trustworthy)

### Adversarial Detection
```
Attack Detected: No ✓
Robustness Level: HIGH
```
- **Attack Detected**: Whether adversarial perturbations found
- **Robustness Level**: 
  - HIGH = Multiple model types + multi-modal
  - MEDIUM = Multiple models, same type
  - LOW = Single model (vulnerable)

### Partial Manipulation
```
Partial Deepfake Detected: Yes ⚠
Type: face_swap
Suspicious Regions: 2
```
- **Type**: What kind of manipulation (face_swap, mouth_reenactment, etc.)
- **Suspicious Regions**: Number of manipulated areas found
- **Heatmap**: Red = manipulated, Yellow = suspicious, Green = authentic

## Performance Notes

### Expected Processing Times
- **Image**: +250-600ms with all features enabled
- **Webcam**: Real-time (5-10 FPS depending on device)
- **Video**: +250-600ms per frame analyzed

### Disabling Features
If performance is too slow:
1. Open Settings
2. Disable individual features:
   - Calibration: -50-100ms
   - Adversarial: -100-200ms
   - Partial: -150-300ms

## Troubleshooting

### "No Enhanced Results Showing"
- Check Settings → Ensure at least one research feature is enabled
- Verify face was detected in the image/video
- Check browser console for errors (F12)

### "Heatmap Not Visible"
- Click "Show Heatmap" button in Enhanced Results panel
- Ensure "Partial Deepfake Detection" is enabled in Settings
- Verify partial manipulation was detected (check results)

### "Performance Too Slow"
- Disable some research features in Settings
- Change Processing Speed to "Fast" in Settings
- Use smaller images/videos
- Close other browser tabs

### "Build Errors"
```bash
# Reinstall dependencies
npm install

# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

## Testing with Sample Data

### Good Test Cases
1. **Real Images**: Selfies, photos from phone camera
2. **Deepfakes**: Face-swap images from online datasets
3. **AI-Generated**: Images from Stable Diffusion, DALL-E, Midjourney
4. **Videos**: Short clips (10-30 seconds) with faces

### What to Test
- ✅ Calibration accuracy on known real/fake images
- ✅ Adversarial detection with compressed images (JPEG artifacts)
- ✅ Partial detection on face-swap deepfakes
- ✅ Heatmap accuracy (does it highlight the right regions?)
- ✅ Performance on your target device

## Production Deployment

### Backend Setup
1. Set environment variable in Modal:
   ```bash
   DEEPFAKE_API_KEY=your-secret-key-here
   ```

2. Deploy backend:
   ```bash
   cd backend
   modal deploy modal_app.py
   ```

### Frontend Setup
1. Create `.env` file:
   ```
   VITE_DEEPFAKE_API_KEY=your-secret-key-here
   VITE_MODAL_URL=https://your-modal-url.modal.run
   ```

2. Build for production:
   ```bash
   npm run build
   ```

3. Deploy `dist/` folder to your hosting provider

## Documentation

For detailed information, see:
- `docs/features/RESEARCH-GRADE-FEATURES.md` - Complete feature documentation
- `docs/features/BACKEND-AUTH-SETUP.md` - Backend authentication guide
- `IMPROVEMENTS_IMPLEMENTED.md` - Implementation details
- `IMPLEMENTATION_COMPLETE.md` - Project status and next steps

## Support

If you encounter issues:
1. Check browser console (F12) for error messages
2. Review documentation in `docs/features/`
3. Verify all dependencies are installed
4. Ensure Node.js v18+ is being used

## Summary

You now have a production-ready deepfake detection system with:
- ✅ Calibrated confidence scores
- ✅ Adversarial attack detection
- ✅ Partial deepfake localization
- ✅ Real-time webcam analysis
- ✅ Batch video processing
- ✅ Comprehensive audit logging

**Ready to test and deploy!** 🚀
