#!/usr/bin/env node

/**
 * Check if Git LFS files are properly deployed to Vercel
 * 
 * This script checks if ONNX model files on Vercel are actual models
 * or just Git LFS pointer files (which cause ERROR_CODE: 7)
 */

const BASE_URL = 'https://detector-rho.vercel.app';

const models = [
  { name: 'vit_deepfake_exp.onnx', expectedSize: 327 * 1024 * 1024 },
  { name: 'vit_deepfake_v2.onnx', expectedSize: 327 * 1024 * 1024 },
  { name: 'ai_detector_int8.onnx', expectedSize: 307 * 1024 * 1024 },
  { name: 'deepfake_detector.onnx', expectedSize: 91 * 1024 * 1024 },
  { name: 'efficientnet_b4.onnx', expectedSize: 1.2 * 1024 * 1024 },
  { name: 'xception_net.onnx', expectedSize: 0.07 * 1024 * 1024 },
  { name: 'resnet50.onnx', expectedSize: 0.23 * 1024 * 1024 },
];

async function checkModel(model) {
  const url = `${BASE_URL}/models/onnx/${model.name}`;
  
  try {
    console.log(`\n🔍 Checking ${model.name}...`);
    
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch (HTTP ${response.status})`);
      return { name: model.name, status: 'failed', size: 0 };
    }
    
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const sizeMB = (contentLength / 1024 / 1024).toFixed(2);
    const expectedMB = (model.expectedSize / 1024 / 1024).toFixed(2);
    
    console.log(`   Size: ${sizeMB} MB (expected: ${expectedMB} MB)`);
    
    // LFS pointer files are typically ~130 bytes
    if (contentLength < 1000) {
      console.log(`   ⚠️  THIS IS A GIT LFS POINTER FILE! (${contentLength} bytes)`);
      console.log(`   The actual model was not deployed.`);
      return { name: model.name, status: 'lfs-pointer', size: contentLength };
    }
    
    // Check if size is close to expected (within 10%)
    const percentDiff = Math.abs(contentLength - model.expectedSize) / model.expectedSize * 100;
    if (percentDiff < 10) {
      console.log(`   ✅ Looks good! Actual model file deployed.`);
      return { name: model.name, status: 'ok', size: contentLength };
    } else {
      console.log(`   ⚠️  Size mismatch (${percentDiff.toFixed(1)}% difference)`);
      return { name: model.name, status: 'size-mismatch', size: contentLength };
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { name: model.name, status: 'error', size: 0 };
  }
}

async function main() {
  console.log('🚀 Checking if Git LFS files are properly deployed to Vercel...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log('='.repeat(70));
  
  const results = [];
  
  for (const model of models) {
    const result = await checkModel(model);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY\n');
  
  const lfsPointers = results.filter(r => r.status === 'lfs-pointer');
  const ok = results.filter(r => r.status === 'ok');
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error');
  
  console.log(`✅ Properly deployed: ${ok.length}/${models.length}`);
  console.log(`⚠️  LFS pointer files: ${lfsPointers.length}/${models.length}`);
  console.log(`❌ Failed/Error: ${failed.length}/${models.length}`);
  
  if (lfsPointers.length > 0) {
    console.log('\n🔴 PROBLEM DETECTED: Git LFS files not deployed!');
    console.log('\nLFS pointer files found:');
    lfsPointers.forEach(r => {
      console.log(`   - ${r.name} (${r.size} bytes)`);
    });
    console.log('\n💡 SOLUTION:');
    console.log('   1. Host models on Hugging Face (recommended)');
    console.log('   2. Check Vercel build logs for LFS errors');
    console.log('   3. Consider Vercel Pro for LFS support');
    console.log('\n📚 See CHECK_LFS_DEPLOYMENT.md for detailed instructions');
  } else if (ok.length === models.length) {
    console.log('\n✅ All models properly deployed! LFS is working correctly.');
  } else {
    console.log('\n⚠️  Some models have issues. Check details above.');
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
