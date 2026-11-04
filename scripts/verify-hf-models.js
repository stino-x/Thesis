#!/usr/bin/env node

/**
 * Verify Hugging Face model URLs are accessible
 */

const HF_BASE = 'https://huggingface.co/stino214/deepfake-onnx-models/resolve/main';

const models = [
  { name: 'vit_deepfake_exp.onnx', expectedSize: 327 * 1024 * 1024, hasData: false },
  { name: 'vit_deepfake_v2.onnx', expectedSize: 327 * 1024 * 1024, hasData: false },
  { name: 'ai_detector_int8.onnx', expectedSize: 307 * 1024 * 1024, hasData: false },
  { name: 'deepfake_detector.onnx', expectedSize: 91 * 1024 * 1024, hasData: false },
  { name: 'efficientnet_b4.onnx', expectedSize: 1.2 * 1024 * 1024, hasData: true },
  { name: 'efficientnet_b4.onnx.data', expectedSize: 71 * 1024 * 1024, hasData: false },
  { name: 'xception_net.onnx', expectedSize: 0.07 * 1024 * 1024, hasData: true },
  { name: 'xception_net.onnx.data', expectedSize: 3.9 * 1024 * 1024, hasData: false },
  { name: 'resnet50.onnx', expectedSize: 0.23 * 1024 * 1024, hasData: true },
  { name: 'resnet50.onnx.data', expectedSize: 94 * 1024 * 1024, hasData: false },
];

async function checkModel(model) {
  const url = `${HF_BASE}/${model.name}`;
  
  try {
    console.log(`\n🔍 Checking ${model.name}...`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`   ❌ NOT FOUND (404) - File doesn't exist on Hugging Face`);
        return { name: model.name, status: 'missing', size: 0, url };
      }
      console.log(`   ❌ Failed to fetch (HTTP ${response.status})`);
      return { name: model.name, status: 'error', size: 0, url };
    }
    
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const sizeMB = (contentLength / 1024 / 1024).toFixed(2);
    const expectedMB = (model.expectedSize / 1024 / 1024).toFixed(2);
    
    console.log(`   Size: ${sizeMB} MB (expected: ~${expectedMB} MB)`);
    
    // Check if it's a reasonable size
    const percentDiff = Math.abs(contentLength - model.expectedSize) / model.expectedSize * 100;
    if (percentDiff < 20) { // Allow 20% variance
      console.log(`   ✅ Accessible and correct size!`);
      return { name: model.name, status: 'ok', size: contentLength, url };
    } else {
      console.log(`   ⚠️  Size difference: ${percentDiff.toFixed(1)}%`);
      return { name: model.name, status: 'size-mismatch', size: contentLength, url };
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { name: model.name, status: 'error', size: 0, url };
  }
}

async function main() {
  console.log('🚀 Verifying Hugging Face model URLs...');
  console.log(`📍 Repository: stino214/deepfake-onnx-models`);
  console.log(`🔗 Base URL: ${HF_BASE}`);
  console.log('='.repeat(70));
  
  const results = [];
  
  for (const model of models) {
    const result = await checkModel(model);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY\n');
  
  const ok = results.filter(r => r.status === 'ok');
  const missing = results.filter(r => r.status === 'missing');
  const errors = results.filter(r => r.status === 'error');
  const sizeMismatch = results.filter(r => r.status === 'size-mismatch');
  
  console.log(`✅ Accessible and correct: ${ok.length}/${models.length}`);
  console.log(`❌ Missing (404): ${missing.length}/${models.length}`);
  console.log(`❌ Errors: ${errors.length}/${models.length}`);
  console.log(`⚠️  Size mismatch: ${sizeMismatch.length}/${models.length}`);
  
  if (missing.length > 0) {
    console.log('\n🔴 MISSING FILES ON HUGGING FACE:');
    missing.forEach(r => {
      console.log(`   ❌ ${r.name}`);
      console.log(`      Upload with: huggingface-cli upload stino214/deepfake-onnx-models public/models/onnx/${r.name} ${r.name}`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\n⚠️  FILES WITH ERRORS:');
    errors.forEach(r => {
      console.log(`   ❌ ${r.name}`);
    });
  }
  
  if (ok.length === models.length) {
    console.log('\n✅ ALL MODELS VERIFIED! Ready to deploy! 🎉');
    console.log('\nNext steps:');
    console.log('1. Commit changes: git add src/lib/onnx/onnxDetector.ts');
    console.log('2. Commit: git commit -m "fix: use Hugging Face for ONNX model hosting"');
    console.log('3. Push: git push origin main');
    console.log('4. Models will load from Hugging Face (no more LFS issues!)');
  } else {
    console.log('\n⚠️  Some models need attention. See details above.');
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
