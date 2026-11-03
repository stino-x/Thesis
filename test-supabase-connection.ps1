# Test Supabase Connection
# This script tests if your Supabase instance is responding correctly

Write-Host "`n=== Testing Supabase Connection ===" -ForegroundColor Cyan

# Read .env file to get Supabase URL
$envFile = Get-Content .env -ErrorAction SilentlyContinue
$supabaseUrl = ($envFile | Select-String "VITE_SUPABASE_URL=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
$supabaseKey = ($envFile | Select-String "VITE_SUPABASE_ANON_KEY=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })

if (-not $supabaseUrl) {
    Write-Host "❌ Could not find VITE_SUPABASE_URL in .env file" -ForegroundColor Red
    exit 1
}

if (-not $supabaseKey) {
    Write-Host "❌ Could not find VITE_SUPABASE_ANON_KEY in .env file" -ForegroundColor Red
    exit 1
}

Write-Host "Using URL: $supabaseUrl" -ForegroundColor Yellow
Write-Host "Key (first 20 chars): $($supabaseKey.Substring(0, 20))..." -ForegroundColor Yellow

# Test 1: Health check endpoint
Write-Host "`nTest 1: Health Check Endpoint" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/" `
        -Headers @{
            "apikey" = $supabaseKey
        } `
        -Method Get `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "✅ Health check passed! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Check if audit_logs table is accessible (should fail due to RLS)
Write-Host "`nTest 2: Audit Logs Table (expected to fail due to RLS)" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/audit_logs?select=id&limit=1" `
        -Headers @{
            "apikey" = $supabaseKey
            "Authorization" = "Bearer $supabaseKey"
        } `
        -Method Get `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "✅ Audit logs accessible! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "⚠️  Expected: Table protected by RLS (authentication required)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "1. If Test 1 passed, your Supabase connection is working ✓" -ForegroundColor White
Write-Host "2. Add SUPABASE_ANON_KEY to GitHub Secrets" -ForegroundColor White
Write-Host "3. Run the GitHub Actions workflow manually to test" -ForegroundColor White
Write-Host "`nSee docs/setup/FIX_KEEPALIVE_WORKFLOW.md for detailed instructions`n" -ForegroundColor Cyan
