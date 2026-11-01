# E2E Test Fixtures

This directory contains test files for E2E testing.

## Required Files

Create these files for the tests to work:

### test-image.png
A small test image (any PNG image, recommended: 100x100px or smaller)

```bash
# You can create a 1x1 pixel test image with ImageMagick:
convert -size 1x1 xc:white test-image.png

# Or use any small PNG image you have
```

### test-image.jpg
A small test image in JPEG format

```bash
# Convert the PNG to JPG:
convert test-image.png test-image.jpg

# Or use any small JPEG image
```

### test-video.mp4
A short test video (recommended: 1-5 seconds, low resolution)

```bash
# Create a 1-second test video with ffmpeg:
ffmpeg -f lavfi -i color=c=blue:s=320x240:d=1 -c:v libx264 test-video.mp4

# Or use any short MP4 video file
```

## Automated Setup Script

Run this script to auto-generate test fixtures:

**Windows (PowerShell):**
```powershell
# Install ffmpeg and imagemagick via chocolatey if not installed
# choco install ffmpeg imagemagick

# Generate test files
ffmpeg -f lavfi -i color=c=blue:s=320x240:d=1 -c:v libx264 -y e2e/fixtures/test-video.mp4
magick -size 100x100 xc:white e2e/fixtures/test-image.png
magick e2e/fixtures/test-image.png e2e/fixtures/test-image.jpg
```

**Alternative: Manual Creation**
Simply copy any small test files you have:
- Any PNG image → `test-image.png`
- Any JPEG image → `test-image.jpg`
- Any short video → `test-video.mp4`

The tests are designed to be flexible and will work with any valid image/video files.
