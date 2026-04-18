# Demo Quick Reference Card

**Quick reference for live demonstrations - print this out!**

---

## 🎯 Sample Kit Essentials

### Must Have (Minimum)
- ✅ 3 real photos
- ✅ 3 face-swap deepfakes
- ✅ 3 AI-generated images (DALL-E, Midjourney, SD)
- ✅ 1 short video (<30s)

### Nice to Have
- ⭐ 2 partial deepfakes
- ⭐ 1 adversarial example
- ⭐ Webcam ready

---

## 📊 Expected Results Cheat Sheet

| Sample Type | Confidence | Top Model | Key Anomalies |
|-------------|-----------|-----------|---------------|
| **Real Photo** | 5-20% | All agree | None |
| **Face-Swap** | 70-95% | ViT-Exp (>90%) | face_mesh, texture |
| **AI-Generated** | 80-98% | SwinV2 (>95%) | ai_signal, metadata |
| **Partial Deepfake** | 60-85% | ViT models | Heatmap shows regions |
| **Adversarial** | Variable | FFT detects | High-frequency patterns |

---

## 🎬 15-Minute Demo Flow

| Time | Section | What to Show | Key Message |
|------|---------|--------------|-------------|
| 0-2 min | Intro | Landing page, features | Multi-modal, research-grade |
| 2-5 min | Real Images | 2-3 real photos | Low false positives |
| 5-9 min | Deepfakes | 2-3 face swaps | High accuracy detection |
| 9-13 min | AI-Generated | 2-3 AI images | Detects unseen generators |
| 13-15 min | Research Features | Calibration, adversarial, partial | Advanced capabilities |
| +2 min | Bonus | Webcam or video | Real-time performance |

---

## 💬 Key Talking Points

### Opening (30 seconds)
> "This is a production-grade deepfake detection system with 5+ ML models running in your browser. It uses multi-modal analysis - not just visual, but also metadata, physiological signals, and more. It's research-grade with features like confidence calibration and adversarial detection."

### Real Images (1 minute)
> "Real images score very low - 5 to 20% deepfake probability. All models agree this is authentic. No anomalies detected. This shows our low false positive rate."

### Face-Swap Deepfakes (1 minute)
> "Face-swap deepfakes are detected with 70-95% confidence. ViT models score over 90%. Notice the anomalies: face mesh inconsistency, texture artifacts. PPG analysis even detects missing heartbeat signal in the skin."

### AI-Generated Images (1 minute)
> "AI-generated images score 80-98%. SwinV2 is trained on DALL-E, Midjourney, Stable Diffusion. UnivFD uses CLIP to detect even unseen generators - models it was never trained on. This is crucial as new AI generators emerge."

### Research Features (2 minutes)
> "Three research-grade features: First, confidence calibration converts raw scores to true probabilities using Platt scaling. Second, adversarial detection uses FFT analysis to detect attacks. Third, partial localization shows which face regions are manipulated with a heatmap."

### Closing (30 seconds)
> "Everything runs in your browser - no server required except for UnivFD. Real-time webcam at 15-20 FPS. Audit logging for legal workflows. 72 tests passing. Production ready."

---

## 🎨 Visual Cues

### Colors
- 🟢 Green = REAL/Authentic
- 🔴 Red = DEEPFAKE/Manipulated  
- 🟡 Yellow = Warning/Uncertain

### What to Point Out
- ✅ Score breakdown by model
- ✅ Anomalies list
- ✅ Heatmap colors (partial detection)
- ✅ Timeline segments (video)
- ✅ FPS counter (webcam)

---

## 📈 Key Metrics to Mention

### Accuracy
- ViT-Deepfake-Exp: **98.8%**
- SwinV2 AI Detector: **98.1%**
- Ensemble: **>95%**

### Performance
- Image: **~1.5s**
- Video frame: **~600ms**
- Webcam: **15-20 FPS**

### Coverage
- **5+** ML models
- **10** modality types
- **3** research features
- **72** tests passing

---

## 🔧 Pre-Demo Checklist

**5 Minutes Before**:
- [ ] Models cached (check diagnostic panel)
- [ ] Sample files ready and tested
- [ ] Internet connection working
- [ ] Settings configured (sensitivity 0.7)
- [ ] Research features enabled
- [ ] Browser window maximized
- [ ] Close unnecessary tabs

**Settings to Enable**:
- [x] Show bounding boxes
- [x] Show confidence badge
- [x] Enable calibration
- [x] Enable adversarial detection
- [x] Enable partial detection
- [x] Enable defensive transforms

---

## 🎤 Audience-Specific Adjustments

### Technical Audience
- Mention: ONNX, TensorFlow.js, MediaPipe
- Show: Code structure, test coverage
- Emphasize: Architecture, performance optimizations

### Non-Technical Audience
- Focus: Visual results, use cases
- Show: Easy-to-understand demos
- Emphasize: Impact, real-world applications

### Academic Audience
- Mention: Platt scaling, FFT analysis, datasets
- Show: Research features in detail
- Emphasize: Methodology, benchmarks

### Legal/Forensic Audience
- Mention: Audit logging, evidence export
- Show: Compliance features, metadata
- Emphasize: Reliability, chain of custody

---

## ❓ Quick Q&A Responses

**Q: How accurate?**
> "Ensemble >95%, ViT-Exp 98.8% on face swaps"

**Q: Works on videos?**
> "Yes, with temporal consistency. 4x faster with batching"

**Q: AI-generated images?**
> "SwinV2 98.1% on DALL-E/Midjourney/SD. UnivFD handles unseen"

**Q: Can be fooled?**
> "Adversarial attacks exist. We detect them and use defensive transforms"

**Q: Needs internet?**
> "Only for UnivFD/CLIP. All other models work offline"

**Q: How fast?**
> "1.5s per image, 600ms per frame, 15-20 FPS webcam"

**Q: Production ready?**
> "Yes. 72 tests passing, error handling, audit logs, GDPR compliant"

**Q: Privacy?**
> "Runs in browser. No images sent to server (except optional UnivFD)"

---

## 🚨 Troubleshooting

### If Model Loading Fails
- Check internet connection
- Refresh page
- Check browser console for errors
- Use cached models if available

### If Detection is Slow
- Mention: "First run downloads models"
- Show: Model loading status
- Explain: "Subsequent runs are instant"

### If Result is Unexpected
- Explain: "No detector is 100% perfect"
- Show: Score breakdown by model
- Mention: "Ensemble approach reduces errors"

### If Webcam Doesn't Work
- Check: Browser permissions
- Try: Different browser
- Fallback: Use image demo instead

---

## 🎁 Bonus Demo Ideas

### Quick Wins
1. **Side-by-side**: Same image with/without defensive transforms
2. **Model ablation**: Disable models one by one
3. **Sensitivity slider**: Show how threshold affects results
4. **Export**: Download JSON report or CSV metrics

### If Extra Time
1. **Performance panel**: Show timing breakdown
2. **Audit logs**: Statistics and export
3. **Settings tour**: Show all configuration options
4. **Code walkthrough**: Show architecture (if technical audience)

---

## 📱 Emergency Contacts

**If Technical Issues**:
- Backup laptop ready?
- Backup internet (phone hotspot)?
- Pre-recorded video demo?
- Slides as fallback?

---

## ✅ Post-Demo

- [ ] Thank audience
- [ ] Open for questions
- [ ] Share documentation links
- [ ] Collect feedback
- [ ] Follow up with interested parties

---

**Print this card and keep it handy during your demo!**

**Good luck! 🚀**
