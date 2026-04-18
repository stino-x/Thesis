# Sample Sources Guide

**Where to find high-quality samples for testing and demonstration.**

---

## 🖼️ Real Images (Authentic Content)

### Free Stock Photo Sites
**Best for**: High-quality, diverse, professional photos

1. **Unsplash** - https://unsplash.com
   - Search: "portrait", "headshot", "face"
   - License: Free for commercial use
   - Quality: Excellent
   - Diversity: High

2. **Pexels** - https://pexels.com
   - Search: "person", "portrait", "selfie"
   - License: Free for commercial use
   - Quality: Excellent
   - Diversity: High

3. **Pixabay** - https://pixabay.com
   - Search: "face", "portrait", "people"
   - License: Free for commercial use
   - Quality: Good
   - Diversity: Medium

### Your Own Photos
**Best for**: Authentic, known provenance
- Selfies from your phone
- Professional headshots
- Family photos (with permission)
- Social media photos (your own)

### Tips for Real Images
- ✅ Choose high resolution (>1024px)
- ✅ Good lighting and focus
- ✅ Clear face visibility
- ✅ Various angles and expressions
- ✅ Different backgrounds
- ✅ Diverse demographics

---

## 🎭 Face-Swap Deepfakes

### Academic Datasets (Best Quality)

1. **FaceForensics++** - https://github.com/ondyari/FaceForensics
   - Contains: 1000+ videos with face swaps
   - Methods: DeepFakes, Face2Face, FaceSwap, NeuralTextures
   - Quality: Research-grade
   - Access: Request required
   - Best for: Academic presentations

2. **Celeb-DF** - https://github.com/yuezunli/celeb-deepfakeforensics
   - Contains: 590 real + 5639 deepfake videos
   - Quality: High-quality celebrity deepfakes
   - Access: Request required
   - Best for: Celebrity face swaps

3. **DFDC (Facebook)** - https://ai.facebook.com/datasets/dfdc/
   - Contains: 100,000+ videos
   - Quality: Varied (low to high)
   - Access: Kaggle competition dataset
   - Best for: Large-scale testing

### Public Sources

4. **Reddit - r/SFWdeepfakes**
   - URL: https://reddit.com/r/SFWdeepfakes
   - Contains: Community-created deepfakes
   - Quality: Varied
   - Access: Public
   - Note: Check subreddit rules

5. **YouTube Deepfake Compilations**
   - Search: "deepfake compilation", "deepfake examples"
   - Take screenshots of frames
   - Quality: Varied
   - Access: Public
   - Note: Respect copyright

### Generate Your Own

6. **DeepFaceLab** - https://github.com/iperov/DeepFaceLab
   - Type: Desktop software
   - Platform: Windows, Linux
   - Difficulty: Advanced
   - Quality: Excellent
   - Time: Hours to days

7. **FaceSwap** - https://github.com/deepfakes/faceswap
   - Type: Desktop software
   - Platform: Windows, Linux, Mac
   - Difficulty: Advanced
   - Quality: Good
   - Time: Hours to days

8. **Reface App** - https://reface.ai
   - Type: Mobile app
   - Platform: iOS, Android
   - Difficulty: Easy
   - Quality: Good
   - Time: Seconds

### Tips for Deepfakes
- ✅ Get various quality levels (low, medium, high)
- ✅ Different face swap methods
- ✅ Various celebrities and subjects
- ✅ Different lighting conditions
- ✅ Test with known ground truth

---

## 🤖 AI-Generated Images

### DALL-E 3 (OpenAI)

**Access**: ChatGPT Plus subscription
**URL**: https://chat.openai.com
**Prompts to Try**:
- "Photorealistic portrait of a person, professional headshot"
- "Close-up photo of a human face, studio lighting"
- "Realistic selfie of a person smiling"

**Quality**: Excellent
**Cost**: $20/month
**Best for**: High-quality synthetic portraits

### Midjourney

**Access**: Discord subscription
**URL**: https://midjourney.com
**Prompts to Try**:
- "portrait photography, realistic, 8k, detailed --v 6"
- "professional headshot, studio lighting, photorealistic --v 6"
- "close up face photo, natural lighting --v 6"

**Quality**: Excellent
**Cost**: $10-60/month
**Best for**: Artistic and realistic portraits

### Stable Diffusion

**Access**: Free (local) or online services
**URLs**:
- Local: https://github.com/AUTOMATIC1111/stable-diffusion-webui
- Online: https://stablediffusionweb.com
- Civitai: https://civitai.com (models and examples)

**Prompts to Try**:
- "portrait photo of a person, realistic, detailed, 8k"
- "professional headshot, studio lighting, photorealistic"
- "close-up face, natural lighting, high quality"

**Quality**: Good to Excellent
**Cost**: Free (local) or $10-30/month (online)
**Best for**: Customizable, various styles

### Adobe Firefly

**Access**: Adobe Creative Cloud or free tier
**URL**: https://firefly.adobe.com
**Prompts to Try**:
- "Realistic portrait of a person"
- "Professional headshot photo"
- "Close-up face photograph"

**Quality**: Excellent
**Cost**: Free tier available, $5-55/month
**Best for**: Commercial-safe AI images

### Leonardo.ai

**Access**: Free tier available
**URL**: https://leonardo.ai
**Prompts to Try**:
- "Photorealistic portrait, detailed face"
- "Professional headshot, studio lighting"
- "Realistic human face, close-up"

**Quality**: Good to Excellent
**Cost**: Free tier, $10-30/month
**Best for**: Fast generation, various models

### Tips for AI-Generated Images
- ✅ Use "photorealistic" in prompts
- ✅ Specify "portrait" or "headshot"
- ✅ Try different generators
- ✅ Save generation parameters
- ✅ Note which generator was used
- ✅ Check for typical AI artifacts (hands, text, backgrounds)

---

## 🎨 Partial Deepfakes

### Academic Datasets

1. **FaceForensics++ (with masks)**
   - Contains manipulation masks
   - Shows which regions were altered
   - Research-grade quality

2. **Face2Face Dataset**
   - Facial reenactment (expression transfer)
   - Partial face manipulation
   - Good for testing partial detection

### Create Your Own

**Method 1: Photoshop + Face Swap**
1. Use Photoshop to swap only eyes or mouth
2. Blend carefully
3. Export as JPEG

**Method 2: DeepFaceLab with Masks**
1. Use DeepFaceLab
2. Adjust mask to cover only part of face
3. Train and export

**Method 3: FaceSwap with Region Selection**
1. Use FaceSwap tool
2. Select specific face regions
3. Process and export

### Tips for Partial Deepfakes
- ✅ Focus on eyes, mouth, or nose
- ✅ Blend edges carefully
- ✅ Test with known manipulation regions
- ✅ Document which regions were altered

---

## ⚔️ Adversarial Examples (Advanced)

### Research Papers with Examples

1. **Adversarial Robustness Toolbox (ART)**
   - URL: https://github.com/Trusted-AI/adversarial-robustness-toolbox
   - Contains: Tools to generate adversarial examples
   - Difficulty: Advanced
   - Best for: Technical demonstrations

2. **CleverHans**
   - URL: https://github.com/cleverhans-lab/cleverhans
   - Contains: Adversarial attack library
   - Difficulty: Advanced
   - Best for: Research presentations

### Generate Your Own

**Method: FGSM (Fast Gradient Sign Method)**
```python
# Requires: TensorFlow/PyTorch
# Add small perturbations to fool detector
# See: adversarial attack tutorials
```

**Method: PGD (Projected Gradient Descent)**
```python
# More sophisticated attack
# Iterative perturbations
# See: adversarial robustness papers
```

### Tips for Adversarial Examples
- ⚠️ Advanced topic - optional for most demos
- ✅ Explain what adversarial attacks are
- ✅ Show how system detects them
- ✅ Demonstrate defensive transforms
- ✅ Use for technical audiences only

---

## 🎥 Videos

### Real Videos

**Your Own**:
- Record yourself talking (10-30 seconds)
- Use good lighting
- Clear face visibility
- Various expressions

**Stock Video Sites**:
1. **Pexels Videos** - https://pexels.com/videos
2. **Pixabay Videos** - https://pixabay.com/videos
3. **Videvo** - https://videvo.net

### Deepfake Videos

**Datasets**:
1. **FaceForensics++** (best quality)
2. **Celeb-DF** (celebrity deepfakes)
3. **DFDC** (large-scale)

**YouTube**:
- Search: "deepfake video example"
- Download short clips (10-30 seconds)
- Use: youtube-dl or similar tools

**Generate Your Own**:
1. **DeepFaceLab** (video to video)
2. **First Order Motion Model** (expression transfer)
3. **Wav2Lip** (lip-sync deepfakes)

### AI-Generated Videos (Emerging)

1. **Runway Gen-2** - https://runwayml.com
   - Text-to-video generation
   - Quality: Good
   - Cost: Subscription

2. **Synthesia** - https://synthesia.io
   - AI avatar videos
   - Quality: Excellent
   - Cost: Subscription

3. **D-ID** - https://d-id.com
   - Talking head videos
   - Quality: Good
   - Cost: Free tier available

### Tips for Videos
- ✅ Keep videos short (<30 seconds)
- ✅ Good lighting and resolution
- ✅ Clear face visibility throughout
- ✅ Test processing time beforehand
- ✅ Have backup shorter clips

---

## 📦 Recommended Sample Kit

### Minimum Kit (Quick Demo)
```
samples/
├── real/
│   ├── real_portrait_1.jpg (Unsplash)
│   ├── real_portrait_2.jpg (Pexels)
│   └── real_selfie.jpg (Your own)
├── deepfake/
│   ├── deepfake_celebrity_1.jpg (FaceForensics++)
│   ├── deepfake_faceswap.jpg (Reface app)
│   └── deepfake_quality_high.jpg (DeepFaceLab)
├── ai_generated/
│   ├── dalle3_portrait.jpg (ChatGPT)
│   ├── midjourney_face.jpg (Midjourney)
│   └── stable_diffusion_headshot.jpg (SD)
└── video/
    ├── real_talking.mp4 (Your own)
    └── deepfake_video.mp4 (FaceForensics++)
```

### Complete Kit (Full Presentation)
```
samples/
├── real/ (5-10 images)
├── deepfake/ (5-10 images, various quality)
├── ai_generated/ (5-10 images, various generators)
├── partial/ (3-5 images)
├── adversarial/ (2-3 images, optional)
└── video/ (2-3 videos, <30s each)
```

---

## ⚖️ Legal & Ethical Considerations

### Copyright
- ✅ Use royalty-free stock photos
- ✅ Use your own photos
- ✅ Request permission for others' photos
- ⚠️ Be careful with celebrity images
- ⚠️ Respect dataset licenses

### Privacy
- ✅ Don't use private photos without permission
- ✅ Blur faces if needed for privacy
- ✅ Don't share sensitive content
- ⚠️ Be mindful of GDPR/privacy laws

### Ethics
- ✅ Use for educational purposes
- ✅ Demonstrate detection, not creation
- ✅ Explain risks of deepfakes
- ⚠️ Don't create harmful content
- ⚠️ Don't use for deception

### Attribution
- ✅ Credit sources when possible
- ✅ Mention datasets used
- ✅ Link to original creators
- ✅ Follow license requirements

---

## 🔗 Quick Links

### Datasets
- FaceForensics++: https://github.com/ondyari/FaceForensics
- Celeb-DF: https://github.com/yuezunli/celeb-deepfakeforensics
- DFDC: https://ai.facebook.com/datasets/dfdc/

### Stock Photos
- Unsplash: https://unsplash.com
- Pexels: https://pexels.com
- Pixabay: https://pixabay.com

### AI Generators
- ChatGPT (DALL-E 3): https://chat.openai.com
- Midjourney: https://midjourney.com
- Stable Diffusion: https://stablediffusionweb.com
- Adobe Firefly: https://firefly.adobe.com

### Tools
- DeepFaceLab: https://github.com/iperov/DeepFaceLab
- FaceSwap: https://github.com/deepfakes/faceswap
- Reface App: https://reface.ai

---

## 📝 Sample Naming Convention

Use descriptive names for easy identification:

```
[type]_[source]_[quality]_[number].jpg

Examples:
- real_unsplash_high_1.jpg
- deepfake_celebrity_medium_2.jpg
- ai_dalle3_portrait_1.jpg
- partial_eyes_only_1.jpg
- adversarial_fgsm_1.jpg
- video_real_talking_1.mp4
```

---

## ✅ Pre-Demo Checklist

Before your presentation:

- [ ] Downloaded 3+ real images
- [ ] Downloaded 3+ deepfake images
- [ ] Downloaded 3+ AI-generated images
- [ ] Downloaded 1+ video (optional)
- [ ] Tested each sample in the system
- [ ] Documented expected results
- [ ] Organized files in folders
- [ ] Named files descriptively
- [ ] Checked licenses and permissions
- [ ] Prepared attribution list
- [ ] Created backup copies

---

**Happy sample hunting! 🎯**

**Remember**: Quality over quantity. 3-5 good samples per category is better than 20 mediocre ones.
