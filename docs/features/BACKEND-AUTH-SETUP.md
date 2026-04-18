# Backend Authentication Setup

The Modal.com backend now requires authentication to prevent abuse of your free-tier endpoint.

## Quick Setup

### 1. Generate a Secret

```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Or use any random string generator
# Example output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 2. Configure Backend (Modal)

Create a Modal secret:

```bash
modal secret create deepfake-backend-secret BACKEND_SECRET=your-secret-here
```

Or set it in your Modal dashboard:
1. Go to https://modal.com/secrets
2. Create new secret named `deepfake-backend-secret`
3. Add key: `BACKEND_SECRET` with your generated secret

### 3. Configure Frontend

Add to your `.env` file:

```bash
VITE_BACKEND_SECRET=your-secret-here
```

### 4. Deploy

```bash
modal deploy backend/modal_app.py
```

## Local Development

For local development, you can skip authentication:

1. Don't set `BACKEND_SECRET` in backend
2. Don't set `VITE_BACKEND_SECRET` in frontend
3. Backend will log: "WARNING: BACKEND_SECRET not set — authentication disabled!"

## Testing

### Test Health Endpoint

```bash
curl https://your-username--deepfake-detect-api.modal.run/health
```

Should return:
```json
{
  "status": "ok",
  "clip_loaded": true,
  "univfd_loaded": true,
  "auth_enabled": true
}
```

### Test Detection Without Auth (should fail)

```bash
curl -X POST https://your-username--deepfake-detect-api.modal.run/detect \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,...", "filename": "test.jpg"}'
```

Should return:
```json
{
  "detail": "Invalid or missing X-API-Key header"
}
```

### Test Detection With Auth (should succeed)

```bash
curl -X POST https://your-username--deepfake-detect-api.modal.run/detect \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-here" \
  -d '{"image": "data:image/jpeg;base64,...", "filename": "test.jpg"}'
```

Should return detection results.

## Security Best Practices

1. **Never commit secrets to git**
   - `.env` is in `.gitignore`
   - Use Modal secrets for production

2. **Rotate secrets periodically**
   - Generate new secret every 3-6 months
   - Update both backend and frontend

3. **Use different secrets for dev/prod**
   - Development: simple secret or no auth
   - Production: strong random secret

4. **Monitor usage**
   - Check Modal dashboard for unexpected traffic
   - Set up alerts for high usage

## Troubleshooting

### Frontend shows "Backend authentication failed"

Check browser console for:
```
Backend authentication failed — check VITE_BACKEND_SECRET in .env
```

**Solution:** Verify `VITE_BACKEND_SECRET` in `.env` matches `BACKEND_SECRET` in Modal.

### Backend returns 401

**Possible causes:**
1. Secret mismatch between frontend and backend
2. Secret not set in Modal
3. Typo in secret value (check for trailing spaces)

**Debug steps:**
1. Check Modal logs: `modal app logs deepfake-detect-api`
2. Verify secret in Modal dashboard
3. Regenerate secret and update both sides

### Backend shows "WARNING: BACKEND_SECRET not set"

This is normal for local development. If you see this in production:

1. Check Modal secret exists: `modal secret list`
2. Verify secret name matches: `deepfake-backend-secret`
3. Redeploy: `modal deploy backend/modal_app.py`

## Cost Implications

**Without auth:** Anyone can hit your endpoint, potentially exhausting your free tier (30 GB-hours/month).

**With auth:** Only your frontend can access the backend, keeping usage predictable and within free tier limits.

**Typical usage:**
- 1 detection = ~2 seconds = 0.0006 GB-hours
- Free tier = ~50,000 detections/month
- With auth, you control who uses your quota
