#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run all model verification steps
#>

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Model Verification Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install onnxruntime
Write-Host "Step 1: Installing onnxruntime..." -ForegroundColor Yellow
try {
    pip install onnxruntime
    Write-Host "✅ onnxruntime installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install onnxruntime" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan

# Step 2: Re-run verification script (with bug fix)
Write-Host "Step 2: Checking model input shapes..." -ForegroundColor Yellow
Write-Host ""
try {
    python verify_model_preprocessing.py
} catch {
    Write-Host "❌ Model verification failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan

# Step 3: Test aiDetector specifically
Write-Host "Step 3: Testing aiDetector model..." -ForegroundColor Yellow
Write-Host ""
try {
    python test_ai_detector.py
} catch {
    Write-Host "❌ aiDetector test failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Verification Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review the output above for any errors" -ForegroundColor White
Write-Host "2. If aiDetector failed, it may need to be disabled" -ForegroundColor White
Write-Host "3. Test in browser: npm run dev" -ForegroundColor White
Write-Host "4. Upload test images and check detection results" -ForegroundColor White
Write-Host ""
