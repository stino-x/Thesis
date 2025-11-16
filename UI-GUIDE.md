# UI Design Specification: Deepfake Detection Web App

## 🎨 Design Philosophy

**Core Principles:**
- **Trust & Transparency:** Users must understand how detection works
- **Clean & Modern:** Professional aesthetic that inspires confidence
- **Accessible:** Works for both technical and non-technical users
- **Responsive:** Seamless experience on all devices
- **Performance-First:** Fast, smooth interactions

**Visual Style:**
- Dark mode primary (with light mode toggle)
- Cybersecurity/tech aesthetic
- Bold colors for status indicators (green = safe, red = warning)
- Smooth animations, nothing jarring
- Glassmorphism elements for modern feel

---

## 📐 Layout Structure

### Main Application Layout

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER [Logo] [About] [GitHub] [Settings⚙️] [Theme🌙]     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    HERO SECTION                       │  │
│  │                                                       │  │
│  │         Real-time Deepfake Detection                 │  │
│  │    Verify video authenticity using AI                │  │
│  │                                                       │  │
│  │      [Upload Video] [Use Webcam] [Try Sample]        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │                         │  │                         │  │
│  │   VIDEO PLAYER          │  │   DETECTION PANEL       │  │
│  │   [Plays uploaded       │  │   [Shows results        │  │
│  │    video with           │  │    confidence score     │  │
│  │    overlay controls]    │  │    explanations]        │  │
│  │                         │  │                         │  │
│  │   [Play/Pause] [Time]   │  │  Status: Analyzing...   │  │
│  │                         │  │  ███████░░ 78%          │  │
│  │   [▶] [⏸] [⏭] [🔊]     │  │                         │  │
│  │                         │  │  [View Details →]       │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              DETECTION TIMELINE                       │  │
│  │  [Visual timeline showing real/fake segments]         │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │
│  │  0:00  Green   Red    Green      Red        2:45     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  FOOTER [Privacy] [GitHub] [About Project] [Contact]         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Component Specifications

### 1. Header Component

**Design:**
```
┌──────────────────────────────────────────────────────────────┐
│  🔍 DeepFake Detector    [About] [Docs] [GitHub]  ⚙️ 🌙 │
└──────────────────────────────────────────────────────────────┘
```

**Elements:**
- **Logo:** Left side, icon + text "DeepFake Detector"
- **Navigation:** Center/right - About, Documentation, GitHub repo
- **Controls:** Far right - Settings icon, Theme toggle (sun/moon)
- **Style:** 
  - Glass effect background (backdrop-blur)
  - Sticky position (stays on top when scrolling)
  - Height: 64px
  - Shadow on scroll

**Color Scheme:**
- Background: `rgba(15, 23, 42, 0.8)` with backdrop blur
- Text: White/gray
- Hover: Subtle blue glow

---

### 2. Hero Section (Before Upload)

**Design:**
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│         🔍 Real-time Deepfake Detection               │
│                                                        │
│    Verify video authenticity using AI-powered         │
│         computer vision technology                    │
│                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │   📤 Upload  │ │   📹 Webcam  │ │  🎬 Sample   │ │
│  │     Video    │ │              │ │    Videos    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
│                                                        │
│              Drag & drop video here                   │
│           Supports: MP4, WebM, MOV (max 100MB)       │
└────────────────────────────────────────────────────────┘
```

**Features:**
- **Headline:** Large, bold text (48px)
- **Subtitle:** Smaller explanatory text (18px)
- **Three Action Buttons:**
  1. Upload Video (primary action, most prominent)
  2. Use Webcam (secondary)
  3. Try Sample Videos (tertiary, shows examples)
- **Drag & Drop Zone:**
  - Dashed border
  - Hover effect (glowing border)
  - Animated icon when dragging file over
- **Supported Formats:** Small text below

**Visual Style:**
- Gradient background (dark blue to purple)
- Floating animation on icons
- Glassmorphism on cards

---

### 3. Video Upload/Input Component

**Three Input Methods:**

#### A. File Upload
```
┌───────────────────────────────────────────┐
│         📤 Drop video here               │
│                                           │
│      or click to browse files            │
│                                           │
│   Supports: MP4, WebM, MOV (max 100MB)   │
└───────────────────────────────────────────┘
```

**States:**
- **Idle:** Dashed border, hover effect
- **Dragging:** Solid border, blue glow, scale up slightly
- **Uploading:** Progress bar with percentage
- **Error:** Red border with error message

#### B. Webcam Input
```
┌───────────────────────────────────────────┐
│        📹 Enable Webcam Access           │
│                                           │
│   [Start Recording]                       │
│                                           │
│   Live detection will analyze your        │
│   webcam feed in real-time                │
└───────────────────────────────────────────┘
```

**Features:**
- Permission request dialog
- Live preview before starting
- Recording indicator (red dot)
- Stop button

#### C. Sample Videos
```
┌─────────────────────────────────────────────┐
│           Try Sample Videos                 │
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  │
│  │ Real │  │ Fake │  │ Real │  │ Fake │  │
│  │ #1   │  │ #1   │  │ #2   │  │ #2   │  │
│  │[img] │  │[img] │  │[img] │  │[img] │  │
│  └──────┘  └──────┘  └──────┘  └──────┘  │
└─────────────────────────────────────────────┘
```

**Features:**
- Thumbnail preview of each sample
- Labels showing if real/fake (for education)
- Click to load and analyze

---

### 4. Video Player Component

**Design:**
```
┌─────────────────────────────────────────────┐
│                                             │
│          [VIDEO PLAYBACK AREA]              │
│                                             │
│         Canvas with face overlay            │
│         (bounding box + heatmap)            │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ [▶] ━━━━●━━━━━━━ 🔊 [⚙️] [🔍]     │   │
│  │ 1:23 / 2:45                         │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Controls (Bottom Bar):**
- **Play/Pause:** Large button (left)
- **Progress Bar:** Interactive, shows buffering
- **Time:** Current / Total duration
- **Volume:** Slider with icon
- **Settings:** Speed, quality options
- **Fullscreen:** Expand button (right)
- **Export:** Download annotated video button

**Overlays:**
- **Face Bounding Box:** Real-time, follows detected face
  - Green border = likely real
  - Red border = likely fake
  - Yellow border = uncertain
- **Confidence Badge:** Floating score (top-right of video)
- **Heatmap Toggle:** Button to show/hide attention overlay

**Visual Effects:**
- Smooth box animations
- Pulsing effect on high-confidence detections
- Fade in/out transitions

---

### 5. Detection Results Panel

**Main Status Card:**
```
┌───────────────────────────────────────────────┐
│  ⚠️  LIKELY DEEPFAKE                         │
│                                               │
│  Confidence: 87.3%                            │
│  ████████████████████░░░░                     │
│                                               │
│  Detection Time: 2.3s                         │
│  Frames Analyzed: 145                         │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │ 🔍 View Detailed Analysis             │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ 📊 Export Report                      │    │
│  └──────────────────────────────────────┘    │
└───────────────────────────────────────────────┘
```

**Status Variations:**

**1. Authentic (Real):**
- ✅ Green checkmark icon
- Green background gradient
- Text: "LIKELY AUTHENTIC"
- Calm, reassuring design

**2. Deepfake Detected:**
- ⚠️ Warning triangle icon
- Red/orange background gradient
- Text: "LIKELY DEEPFAKE"
- Urgent but not scary

**3. Uncertain:**
- ❓ Question mark icon
- Yellow/orange gradient
- Text: "UNCERTAIN - NEEDS REVIEW"
- Neutral design

**4. Processing:**
- 🔄 Spinning loader
- Blue gradient
- Text: "ANALYZING VIDEO..."
- Progress bar showing % complete

---

### 6. Detailed Analysis Panel (Expandable)

**Opens when "View Detailed Analysis" is clicked:**

```
┌─────────────────────────────────────────────────────────┐
│  📊 Detailed Analysis                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Detection Methods Breakdown:                           │
│  ┌──────────────────────────────────────────┐          │
│  │ Neural Network Classifier    92% ████████│          │
│  │ Visual Artifact Detection    78% ███████░│          │
│  │ Temporal Consistency         85% ████████│          │
│  │ Frequency Domain Analysis    81% ████████│          │
│  └──────────────────────────────────────────┘          │
│                                                         │
│  Detected Artifacts:                                    │
│  • Blending inconsistencies around jawline              │
│  • Unnatural eye blinking patterns                      │
│  • Frequency spectrum anomalies                         │
│  • Temporal jitter in frames 45-67                      │
│                                                         │
│  Attention Heatmap:                                     │
│  ┌────────────────────────────────┐                    │
│  │  [Face image with red overlay  │                    │
│  │   highlighting suspicious      │                    │
│  │   regions - jawline, eyes]     │                    │
│  └────────────────────────────────┘                    │
│  Red areas show regions that influenced the decision    │
│                                                         │
│  Model Information:                                     │
│  • Architecture: EfficientNet-B0                        │
│  • Training Dataset: FaceForensics++                    │
│  • Accuracy on Test Set: 83.2%                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- **Method Breakdown:** Horizontal bar chart showing contribution of each method
- **Artifact List:** Bullet points explaining what was detected
- **Heatmap Visualization:** Large image showing attention overlay
- **Model Info:** Transparency about the AI system
- **Collapsible Sections:** Accordion-style for technical details

---

### 7. Detection Timeline Component

**Visual Timeline Below Video:**
```
┌─────────────────────────────────────────────────────────────┐
│  Detection Timeline                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  Green   Red    Green       Red          Green            │
│  0:00    0:30   1:00        1:30         2:00         2:45 │
│  ✓       ⚠      ✓           ⚠            ✓                │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- **Color-Coded Segments:**
  - Green = Authentic
  - Red = Suspicious
  - Yellow = Uncertain
  - Gray = Not analyzed (no face detected)
- **Interactive:** Click to jump to that timestamp
- **Hover:** Show confidence score at that moment
- **Markers:** Icons showing key detections

**Visual Style:**
- Smooth gradient transitions between colors
- Animated scanning line during processing
- Glow effect on current timestamp

---

### 8. Settings Panel (Modal)

**Opened from settings icon in header:**
```
┌───────────────────────────────────────────┐
│  ⚙️ Settings                    [✕ Close] │
├───────────────────────────────────────────┤
│                                           │
│  Processing Speed                         │
│  ○ Fast (lower accuracy, faster)          │
│  ● Balanced (recommended)                 │
│  ○ Accurate (higher accuracy, slower)     │
│                                           │
│  ─────────────────────────────────────    │
│                                           │
│  Detection Sensitivity                    │
│  [────────●─────────] 0.7                │
│  Lower = fewer false positives            │
│                                           │
│  ─────────────────────────────────────    │
│                                           │
│  Display Options                          │
│  ☑ Show face bounding boxes              │
│  ☑ Show attention heatmap                │
│  ☑ Show confidence badge                 │
│  ☐ Show technical details                │
│                                           │
│  ─────────────────────────────────────    │
│                                           │
│  Frame Rate                               │
│  Process every [▼ 3rd] frame              │
│                                           │
│  ─────────────────────────────────────    │
│                                           │
│  [Reset to Defaults] [Save Settings]      │
└───────────────────────────────────────────┘
```

**Settings Options:**
- **Processing Speed:** Radio buttons (Fast/Balanced/Accurate)
- **Sensitivity Threshold:** Slider (0.5-0.9)
- **Display Toggles:** Checkboxes for overlays
- **Frame Rate:** Dropdown (every 1st/3rd/5th frame)
- **Export Format:** Dropdown (JSON/PDF/CSV)

---

### 9. About/Help Modal

```
┌─────────────────────────────────────────────────┐
│  ℹ️ About DeepFake Detector        [✕ Close]   │
├─────────────────────────────────────────────────┤
│                                                 │
│  What is this?                                  │
│  This tool uses machine learning to detect      │
│  AI-generated deepfake videos in real-time.     │
│                                                 │
│  How it works:                                  │
│  1. Upload a video or use your webcam          │
│  2. AI analyzes facial features frame-by-frame │
│  3. Results show authenticity confidence        │
│  4. Heatmaps explain suspicious regions         │
│                                                 │
│  How accurate is it?                            │
│  • Test Accuracy: 83.2%                         │
│  • False Positive Rate: ~8%                     │
│  • Not 100% reliable - use as guidance          │
│                                                 │
│  Privacy:                                       │
│  ✓ All processing happens in your browser      │
│  ✓ No videos uploaded to servers               │
│  ✓ No data collection                          │
│                                                 │
│  Learn More:                                    │
│  [📖 Documentation] [💻 GitHub] [📧 Contact]   │
│                                                 │
│  Built with: React, TensorFlow.js, MediaPipe   │
│  BSc Thesis Project - [University Name]        │
└─────────────────────────────────────────────────┘
```

---

### 10. Loading States

**Initial Load:**
```
┌──────────────────────────────────┐
│                                  │
│        🔄 Loading Model...       │
│                                  │
│    ████████████░░░░░░░░ 68%     │
│                                  │
│   Downloading neural network     │
│   (18.4 MB / 25 MB)              │
│                                  │
└──────────────────────────────────┘
```

**Processing Video:**
```
┌──────────────────────────────────┐
│                                  │
│    🔍 Analyzing Video...         │
│                                  │
│    ██████████████░░░░░░ 72%     │
│                                  │
│   Frame 145 / 200                │
│   Estimated time: 8 seconds      │
│                                  │
│   [⏸ Pause] [✕ Cancel]          │
└──────────────────────────────────┘
```

**Features:**
- Animated progress bar
- Percentage and frame count
- Estimated time remaining
- Cancel option

---

## 🎨 Color Palette

### Dark Mode (Primary)
```css
/* Background */
--bg-primary: #0f172a      /* Deep dark blue */
--bg-secondary: #1e293b    /* Slightly lighter */
--bg-card: #334155         /* Card backgrounds */

/* Text */
--text-primary: #f8fafc    /* Almost white */
--text-secondary: #94a3b8  /* Gray */
--text-muted: #64748b      /* Darker gray */

/* Status Colors */
--status-real: #10b981     /* Green - authentic */
--status-fake: #ef4444     /* Red - deepfake */
--status-uncertain: #f59e0b /* Amber - uncertain */
--status-processing: #3b82f6 /* Blue - analyzing */

/* Accents */
--accent-primary: #6366f1   /* Indigo */
--accent-secondary: #8b5cf6 /* Purple */
--border: #475569           /* Borders */

/* Glassmorphism */
--glass-bg: rgba(51, 65, 85, 0.7)
--glass-border: rgba(148, 163, 184, 0.2)
```

### Light Mode (Optional)
```css
--bg-primary: #ffffff
--bg-secondary: #f8fafc
--bg-card: #f1f5f9
--text-primary: #0f172a
--text-secondary: #475569
--text-muted: #94a3b8
```

---

## 🎭 Animation Guidelines

**Micro-interactions:**
- **Button Hover:** Scale(1.05) + glow effect
- **Card Hover:** Translate Y(-4px) + shadow increase
- **Loading:** Pulse animation (0.5s ease-in-out)
- **Status Change:** Fade transition (300ms)
- **Progress Bars:** Smooth width animation (linear)

**Page Transitions:**
- **Upload → Processing:** Fade in results panel (500ms)
- **Processing → Results:** Scale up card (400ms) with bounce
- **Modal Open:** Fade in backdrop + slide down modal (300ms)

**Face Detection Overlay:**
- **Bounding Box:** Smooth interpolation between positions
- **Confidence Badge:** Pulse when high confidence
- **Heatmap:** Fade in/out (200ms) when toggled

**Performance:**
- Use `transform` and `opacity` for GPU acceleration
- Avoid animating `width`, `height`, `top`, `left`
- Maximum 60fps target

---

## 📱 Responsive Design Breakpoints

### Desktop (1024px+)
- Side-by-side video and results panel
- Full-width timeline
- 3-column feature grid

### Tablet (768px - 1024px)
- Stacked video and results
- 2-column feature grid
- Collapsible sidebar

### Mobile (< 768px)
- Single column layout
- Smaller video player
- Simplified controls
- Bottom sheet for results
- Hamburger menu for navigation

**Mobile-Specific Features:**
- Touch-friendly buttons (min 44px)
- Swipe gestures for timeline
- Bottom navigation bar
- Reduced animations (performance)

---

## ♿ Accessibility Requirements

**Keyboard Navigation:**
- Tab order: Header → Upload → Video controls → Results → Footer
- Focus visible: 2px blue outline
- Skip to content link
- Escape key closes modals

**Screen Readers:**
- ARIA labels on all interactive elements
- Alt text for images and icons
- Live regions for status updates
- Semantic HTML (header, main, nav, section)

**Visual:**
- Color contrast ratio ≥ 4.5:1 (WCAG AA)
- Text resizable up to 200%
- No text in images (use SVG with text)
- Sufficient whitespace

**Captions & Audio:**
- Video playback supports captions
- Visual indicators for audio cues
- Alternative text descriptions

---

## 🖼️ Icon System

**Use Lucide React or Heroicons:**

**Common Icons:**
- Upload: `Upload` or `CloudUpload`
- Video: `Video` or `Film`
- Camera: `Camera` or `Webcam`
- Play/Pause: `Play`, `Pause`
- Settings: `Settings` or `Sliders`
- Info: `Info` or `HelpCircle`
- Check: `CheckCircle`
- Warning: `AlertTriangle`
- Error: `XCircle`
- Processing: `Loader` (spinning)
- Heatmap: `Activity` or `TrendingUp`
- Export: `Download`
- Close: `X`
- Fullscreen: `Maximize`
- GitHub: `Github`

**Icon Guidelines:**
- Size: 20px (small), 24px (default), 32px (large)
- Stroke width: 2px
- Color: Inherit from parent or theme
- Animated: Spin for loaders, pulse for alerts

---

## 📦 Component Library Recommendations

**Option 1: Headless UI + Tailwind (Recommended)**
```bash
npm install @headlessui/react tailwindcss
```
- Fully customizable
- Accessible by default
- Lightweight

**Option 2: Shadcn/ui (Also Great)**
```bash
npx shadcn-ui@latest init
```
- Beautiful pre-built components
- Copy-paste approach
- Tailwind-based

**Option 3: Radix UI + Custom Styles**
```bash
npm install @radix-ui/react-*
```
- Unstyled primitives
- Maximum flexibility
- Great accessibility

---

## 🚀 Implementation Priority

### Phase 1: MVP (Week 10-12)
1. ✅ Basic layout structure
2. ✅ File upload component
3. ✅ Video player with controls
4. ✅ Simple results card (confidence only)
5. ✅ Loading states

### Phase 2: Core Features (Week 13-15)
6. ✅ Face detection overlay
7. ✅ Detection timeline
8. ✅ Settings panel
9. ✅ Responsive design

### Phase 3: Polish (Week 16-20)
10. ✅ Heatmap visualization
11. ✅ Detailed analysis panel
12. ✅ Webcam support
13. ✅ Sample videos
14. ✅ About/Help modal
15. ✅ Animations and micro-interactions
16. ✅ Dark/Light mode toggle
17. ✅ Export functionality

---

## 💬 AI Prompt to Generate This UI

**Copy and paste this to Claude/ChatGPT/Copilot:**

```
Create a modern, professional deepfake detection web application UI with the following specifications:

LAYOUT:
- Dark mode aesthetic with cybersecurity/tech vibe
- Glassmorphism effects on cards and modals
- Responsive design (mobile-first)
- Header with logo, navigation, settings, theme toggle
- Main content area with video player (left) and results panel (right)
- Detection timeline below video showing real/fake segments
- Footer with links

COMPONENTS NEEDED:

1. HERO SECTION (before video upload):
   - Large headline: "Real-time Deepfake Detection"
   - Subtitle explaining the tool
   - Three action buttons: Upload Video, Use Webcam, Try Samples
   - Drag-and-drop zone with animated hover effects
   - Gradient background (dark blue to purple)

2. VIDEO PLAYER:
   - HTML5 video with custom controls
   - Canvas overlay for face bounding boxes (green=real, red=fake)
   - Play/pause, progress bar, volume, fullscreen buttons
   - Confidence badge floating on top-right
   - Toggle for attention heatmap overlay

3. RESULTS PANEL:
   - Large status card showing verdict (Authentic/Deepfake/Uncertain)
   - Color-coded: green=safe, red=warning, yellow=uncertain
   - Confidence percentage with progress bar
   - Detection time and frames analyzed
   - "View Details" button (expandable accordion)
   - "Export Report" button

4. DETAILED ANALYSIS (collapsible):
   - Horizontal bar chart showing detection method breakdown
   - List of detected artifacts (bullet points)
   - Large attention heatmap image
   - Model information (architecture, accuracy)

5. DETECTION TIMELINE:
   - Visual timeline below video
   - Color-coded segments (green/red/yellow)
   - Interactive (click to jump to timestamp)
   - Shows confidence at each point

6. SETTINGS MODAL:
   - Processing speed (Fast/Balanced/Accurate)
   - Sensitivity slider (0.5-0.9)
   - Display toggles (show boxes, heatmap, etc.)
   - Frame rate selector

7. LOADING STATES:
   - Model loading (progress bar + MB downloaded)
   - Video processing (frame count + ETA)
   - Smooth animations

VISUAL STYLE:
- Color palette: Deep dark blue (#0f172a), indigo accents (#6366f1)
- Status colors: Green (#10b981), Red (#ef4444), Yellow (#f59e0b)
- Glassmorphism: backdrop-blur, semi-transparent backgrounds
- Smooth animations: hover effects, transitions (300-500ms)
- Modern sans-serif font (Inter or similar)
- Icons: Lucide React or Heroicons
- Shadows: Subtle glows and elevation

TECH STACK:
- React 18 + TypeScript
- Tailwind CSS for styling
- Framer Motion for animations (optional)
- Headless UI or Shadcn/ui for accessible components

ACCESSIBILITY:
- WCAG 2.1 AA compliant
- Keyboard navigable (tab order, focus indicators)
- ARIA labels on all interactive elements
- Color contrast ≥ 4.5:1
- Screen reader friendly

Make it look like a professional, trustworthy security tool with a modern, tech-forward aesthetic. Think: gradient accents, smooth animations, clean typography, and a color scheme that inspires confidence.

Generate the complete React component structure with Tailwind classes.
```

---

## 📸 Visual References (Inspiration)

**Design Inspiration:**
- **Linear.app** - Clean, modern UI with glassmorphism
- **Vercel Dashboard** - Dark mode, smooth animations
- **Stripe Dashboard** - Professional, trustworthy feel
- **GitHub Dark Theme** - Developer-friendly aesthetic
- **Figma** - Intuitive controls, smooth interactions

**Similar Tools for Reference:**
- **Grammarly** - Confidence scores, explanations
- **Loom** - Video player with annotations
- **VirusTotal** - Security analysis breakdown
- **DeepTrace (defunct)** - Deepfake detection UI

