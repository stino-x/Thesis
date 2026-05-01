# User Documentation - Deepfake Detection System

**Author:** Augustine Iheagwara  
**Date:** April 26, 2026  
**Version:** 1.0

---

## Introduction

This is a web-based application I built to detect deepfakes and AI-generated images. It runs machine learning models directly in your browser to analyze images, videos, or live webcam feeds. The goal was to create something that's both powerful and accessible - you don't need to install anything or upload sensitive images to a server.

The system uses multiple detection approaches at once. Some models are trained to catch face swaps, others spot AI-generated content from tools like DALL-E or Midjourney. By combining different detection methods, I get better accuracy than any single approach could provide.

---

## Getting Started

### System Requirements

**Browser:**
- Chrome or Edge (recommended) - best performance
- Firefox (supported)
- Safari (limited support)

**Internet Connection:**
- Required for first-time model download (~1.1 GB)
- Optional after that - most features work offline
- Only the CLIP backend needs internet (and it's optional)

**Hardware:**
- Modern computer (2016 or newer)
- At least 4 GB RAM
- Webcam (optional, only for live detection)

### Accessing the Application

Open your browser and navigate to: https://detector-rho.vercel.app/

The first time you visit, the system will download the machine learning models. This takes a few minutes depending on your connection speed. After that, everything is cached locally and loads instantly.

---

## Main Features

### 1. Image Analysis

Upload a single image to check if it's been manipulated or AI-generated.

**How to use:**
1. Click the "Detection" tab in the navigation
2. Select "Image" mode
3. Drag and drop an image, or click "Upload Image"
4. Wait for analysis (usually 1-2 seconds)
5. Review the results

**Supported formats:** JPG, PNG, WebP  
**Maximum size:** 10 MB

**What you'll see:**
- Overall verdict: REAL or DEEPFAKE
- Confidence score (0-100%)
- Per-model breakdown showing what each detector thinks
- Detected anomalies (if any)
- Processing time

### 2. Video Analysis

Analyze video files frame-by-frame to detect manipulation.

**How to use:**
1. Click "Video" mode
2. Upload a video file
3. Choose analysis speed (Fast/Balanced/Thorough)
4. Click "Analyze Video"
5. Wait for processing (depends on video length)
6. Review results with timeline

**Supported formats:** MP4, WebM, MOV  
**Maximum size:** 100 MB  
**Maximum length:** 2 minutes recommended

**What you'll see:**
- Overall video verdict
- Frame-by-frame analysis
- Timeline showing suspicious segments in red
- Temporal consistency score
- You can click on the timeline to jump to specific frames

### 3. Live Webcam Detection

Real-time analysis of your webcam feed.

**How to use:**
1. Click "Webcam" mode
2. Click "Start Webcam"
3. Allow camera permissions when prompted
4. Position your face in view
5. Watch real-time detection results

**What you'll see:**
- Live video feed with face detection box
- Real-time confidence score
- Current FPS (frames per second)
- Detection updates every few frames

**Note:** This is meant for testing and demonstration. It shows your real face should be detected as REAL, while showing a deepfake image to the camera should trigger detection.

---

## Understanding the Results

### Confidence Score

The main number you see (0-100%) represents how confident the system is that the content is fake.

- **0-20%:** Likely real/authentic
- **20-40%:** Probably real, but some suspicious signals
- **40-60%:** Uncertain - could go either way
- **60-80%:** Probably fake
- **80-100%:** Very likely fake

### Per-Model Breakdown

The system uses 5 different models. You can expand the results to see what each one thinks:

**ViT Deepfake Exp (98.8% accuracy):**
Best at detecting face-swap deepfakes. If this scores high, there's likely face manipulation.

**ViT Deepfake v2 (92.1% accuracy):**
Another face-swap detector trained on different data. Adds diversity to the ensemble.

**SwinV2 AI Detector (98.1% accuracy):**
Specialized in detecting AI-generated images from Stable Diffusion, DALL-E, Midjourney, etc.

**DeepfakeDetector & MesoNet:**
Additional face manipulation detectors. MesoNet is lightweight and catches classic deepfakes.

**CLIP Backend (optional):**
Helps detect content from newer AI generators the browser models haven't seen. Requires internet.

### Anomalies Detected

The system looks for telltale signs beyond just the ML models:

- **face_mesh_inconsistency:** Face landmarks don't look natural
- **texture_artifacts:** Unusual texture patterns in the face
- **missing_heartbeat_signal:** No blood flow detected in skin (PPG analysis)
- **compression_inconsistencies:** JPEG compression doesn't match across the image
- **metadata_anomalies:** File metadata shows suspicious patterns
- **ai_generation_signal:** Strong indicators of AI generation

More anomalies usually means higher confidence in the detection.

---

## Advanced Features

### Settings

Click the gear icon in the top right to access settings.

**Detection Settings:**

*Sensitivity:*
- Low (0.5): Fewer false positives, might miss subtle fakes
- Medium (0.7): Balanced - recommended
- High (0.9): Catches more fakes, but more false positives

*Processing Speed:*
- Fast: Quicker but less thorough
- Balanced: Good trade-off
- Thorough: Slower but more accurate

**Research-Grade Features:**

*Confidence Calibration:*
Converts raw model scores into proper probabilities. When enabled, you get a confidence interval showing the range where the true probability likely falls. This is important for forensic use where you need to say "85% probability" with statistical backing.

*Adversarial Detection:*
Looks for signs that someone tried to fool the detector by adding invisible noise to the image. Uses frequency analysis to spot these attacks.

*Partial Deepfake Detection:*
Detects when only part of the image is fake (like just the mouth or eyes). Shows a heatmap overlay with red/yellow regions indicating manipulated areas.

*Defensive Transforms:*
Applies preprocessing (JPEG compression, blur, resize) to make the system more robust against adversarial attacks. Slightly slower but more reliable.

### Exporting Results

After analysis, you can export the results:

**JSON Export:**
Complete detection data including all model scores, anomalies, and metadata. Good for keeping records or further analysis.

**CSV Export:**
Simplified format for spreadsheets. Useful if you're analyzing multiple files.

**Screenshot:**
Saves the results panel as an image for reports or presentations.

---

## Common Questions

**Q: Why does it take so long the first time?**  
A: The system downloads 1.1 GB of machine learning models on first use. After that, they're cached and load instantly.

**Q: Does it work offline?**  
A: Mostly yes. Only the CLIP backend needs internet. All the main models work offline once downloaded.

**Q: Where do my images go?**  
A: Nowhere. Everything runs in your browser. Images are not uploaded to any server (except optionally to the CLIP backend if you have that enabled).

**Q: How accurate is it?**  
A: The ensemble is over 95% accurate on the types of deepfakes it was trained on. Individual models range from 90-98.8% accuracy. However, it struggles with adversarial attacks and brand new AI generators it hasn't seen.

**Q: Can it detect all deepfakes?**  
A: No. No detector is perfect. It works well on classic face swaps and known AI generators, but sophisticated deepfakes designed to fool detectors can slip through.

**Q: Why do I get different results each time?**  
A: Some preprocessing steps have randomness (like defensive transforms). Also, if you're using webcam mode, lighting and angle affect results.

**Q: What's the CLIP backend?**  
A: An optional server-side detector that helps catch AI-generated content from newer models. It's deployed on Modal.com and adds about 1-2 seconds to analysis time.

**Q: Can I use this for legal/forensic purposes?**  
A: The system has research-grade features like confidence calibration that make it more suitable for forensic use, but you should consult with legal experts. Always enable calibration for forensic applications.

---

## Troubleshooting

**Problem: Models won't load**  
*Solution:* Check your internet connection. Clear browser cache and reload. Make sure you're using Chrome or Edge.

**Problem: "Face not detected" error**  
*Solution:* Make sure there's a clear, visible face in the image. The face should be at least 100x100 pixels and not too blurry.

**Problem: Webcam not working**  
*Solution:* Check browser permissions. Make sure no other app is using the camera. Try refreshing the page.

**Problem: Very slow performance**  
*Solution:* Close other browser tabs. Try "Fast" processing mode in settings. Disable some research features if you don't need them.

**Problem: Results seem wrong**  
*Solution:* Try enabling defensive transforms in settings. Check if multiple models agree - if they disagree strongly, the result is uncertain.

**Problem: Video analysis fails**  
*Solution:* Make sure video is under 100 MB and 2 minutes. Try a shorter clip. Some codecs aren't supported - try converting to MP4.

---

## Limitations

I want to be honest about what this system can and can't do:

**What works well:**
- Classic face-swap deepfakes
- AI-generated images from known tools (Stable Diffusion, DALL-E, Midjourney)
- High-quality images with clear faces
- Videos with consistent lighting

**What's harder:**
- Adversarial deepfakes designed to fool detectors
- Very high-quality deepfakes with perfect blending
- Low-quality or heavily compressed images
- Faces at extreme angles or partially obscured
- Brand new AI generators that just came out

**Not supported:**
- Audio-only deepfakes (no video)
- Text deepfakes
- Images without faces
- Very large files (>100 MB for video, >10 MB for images)

---

## Privacy and Security

**Data Privacy:**
- All processing happens in your browser
- Images are not sent to any server (except optional CLIP backend)
- No data is stored or logged
- No account required for basic use

**CLIP Backend:**
- If enabled, sends images to Modal.com for analysis
- Images are processed and immediately discarded
- No permanent storage
- You can disable this in settings

**Audit Logs:**
- If you create an account, your detection history is saved
- Only you can see your logs
- Stored securely in Supabase with row-level security
- You can delete your data anytime

---

## Support

If you encounter issues or have questions:

1. Check this documentation
2. Review the troubleshooting section
3. Check browser console for error messages (F12)
4. Contact: austindev214@gmail.com | +36 70 301 6866

---

## Credits

**Models Used:**
- ViT Deepfake models from HuggingFace
- SwinV2 AI Detector by haywoodsloan
- MesoNet by Afchar et al.
- CLIP by OpenAI
- MediaPipe by Google

**Technologies:**
- React, TypeScript, Vite
- TensorFlow.js, ONNX Runtime Web
- Supabase, Modal.com

**Developed by:** Augustine Iheagwara  
**Institution:** ELTE Faculty of Informatics  
**Year:** 2026
