#!/usr/bin/env node

/**
 * Download AASIST model from Hugging Face during build
 * This runs automatically during npm install / Vercel build
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// 🔗 CONFIGURATION - Update with your Hugging Face URL
// ============================================================================

const AASIST_URL = process.env.AASIST_MODEL_URL || 
  'https://huggingface.co/stino214/forensics-adapter-weights/resolve/main/aasist.onnx';

const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'models', 'audio', 'aasist.onnx');

// ============================================================================

console.log('📥 Downloading AASIST model from Hugging Face...');
console.log(`   Source: ${AASIST_URL}`);
console.log(`   Target: ${OUTPUT_PATH}`);
console.log('');

// Check if URL is still placeholder
if (AASIST_URL.includes('YOUR_USERNAME')) {
  console.log('⚠️  AASIST_MODEL_URL not configured yet');
  console.log('   Set environment variable AASIST_MODEL_URL or update scripts/download-models.js');
  console.log('   Skipping download for now...');
  process.exit(0);
}

// Create directory if it doesn't exist
const dir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Download function with redirect support
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const request = client.get(url, { headers: { 'User-Agent': 'Node.js' } }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log(`   Following redirect to: ${redirectUrl}`);
        downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastProgress = 0;
      
      const fileStream = fs.createWriteStream(outputPath);
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = Math.floor((downloadedSize / totalSize) * 100);
        
        // Show progress every 10%
        if (progress >= lastProgress + 10) {
          console.log(`   Progress: ${progress}% (${Math.round(downloadedSize / 1024 / 1024)} MB / ${Math.round(totalSize / 1024 / 1024)} MB)`);
          lastProgress = progress;
        }
      });
      
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        console.log('   Progress: 100%');
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(300000, () => { // 5 minute timeout
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// Main download
downloadFile(AASIST_URL, OUTPUT_PATH)
  .then(() => {
    const stats = fs.statSync(OUTPUT_PATH);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log('');
    console.log(`✅ AASIST model downloaded successfully!`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Location: ${OUTPUT_PATH}`);
    console.log('');
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Failed to download AASIST model');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('   Manual download:');
    console.error(`   1. Visit: ${AASIST_URL.replace('YOUR_USERNAME', 'YOUR-HUGGINGFACE-USERNAME')}`);
    console.error(`   2. Save to: ${OUTPUT_PATH}`);
    console.error('');
    
    // Don't fail the build - model loading will handle gracefully
    process.exit(0);
  });
