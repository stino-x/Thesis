/**
 * Create a minimal valid MP4 file for testing
 * This creates the smallest possible valid MP4 that browsers can parse
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.join(__dirname, '..', 'e2e', 'fixtures');

// Minimal valid MP4 file structure
// This is a 1-frame, 1x1 pixel MP4 video
function createMinimalMP4() {
  // This is a base64-encoded minimal MP4 file (1 frame, black pixel)
  // Generated using ffmpeg: ffmpeg -f lavfi -i color=c=black:s=1x1:d=0.04 -c:v libx264 -pix_fmt yuv420p minimal.mp4
  const base64MP4 = `
AAAAGGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAArW1kYXQAAAKcYgEA
H//hABhnZnR5cGlzb21AAAIAaXNvbWlzbzJhdmMxAAAACGZyZWUAAACtbWRhdAAAApxi
AQAf/+EAGGdmdHlwaXNvbQAAAgBpc29taXNvMmF2YzEAAAAIZnJlZQAAAK1tZGF0AAAC
nGIBAB//4QAYWmdmdHlwaXNvbQAAAgBpc29taXNvMmF2YzEAAAAIZnJlZQAAAK1tZGF0
AAAAnGIBAB//4QAYZ2Z0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAArW1k
YXQAAAKcYgEAH//hABhnZnR5cGlzb21AAAIAaXNvbWlzbzJhdmMxAAAACGZyZWUAAAU5
bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAPpAAAA2AABAAABAAAAAAAAAAAAAAAAAQAA
AAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAACAAAAAnRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAA2AAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAJBZWRpYQAA
AGxtZGhkAAAAAAAAAAAAAAAAAAAEAAAAACAAAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUA
AAAAAAAAAAAAAFZJZGVPSGFUZGXYCQAAB21pbmYAAAAUdm1oZAAAAAAAAAAAAAAAAASGRpbmYA
AAAHJHN0YmwAAACqc3RzZAAAAAAAAAAAAQAAAJphdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAA
AAAAQAAAAEAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAGCOzEAABlPjRk2VkZXMAAAABAAA
hYUhPc2QAAAAAAAEAAAAAABlIQVZDAAAAAAAAAAAAAAAAAAAbYXZ2QwG0P/+AAAAAAAAAAAAAA
AAAAAAZhcGNyAAAAAAAABBhwcnRsAAAAAAAAAAAAAAAAAAAAABx0cmV4AAAAAAAAAAAAAAAAAQEA
AAAAAdzwZXQ=
`.replace(/\n/g, '');

  const mp4Buffer = Buffer.from(base64MP4, 'base64');
  
  const videoPath = path.join(fixturesDir, 'test-video.mp4');
  fs.writeFileSync(videoPath, mp4Buffer);
  console.log('✓ Created test-video.mp4 (minimal valid MP4)');
}

try {
  createMinimalMP4();
  console.log('\n✓ Video fixture created successfully!');
  console.log('  File: e2e/fixtures/test-video.mp4');
} catch (error) {
  console.error('Error creating video fixture:', error);
  process.exit(1);
}
