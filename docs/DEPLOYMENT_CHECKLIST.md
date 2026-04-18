# Deployment Checklist

## Pre-Deployment Verification ✅

### Build & Tests
- [x] Production build successful (`npm run build`)
- [x] All 72 tests passing (`npm test`)
- [x] No TypeScript errors
- [x] No console errors in dev mode

### Code Quality
- [x] All diagnostics passing
- [x] All imports resolve
- [x] No unused variables
- [x] Documentation complete

---

## Backend Deployment

### Modal Setup
1. [ ] Create Modal account (if not exists)
2. [ ] Install Modal CLI: `pip install modal`
3. [ ] Login: `modal token new`
4. [ ] Set environment variable:
   ```bash
   modal secret create deepfake-api-key DEEPFAKE_API_KEY=your-secret-key-here
   ```
5. [ ] Deploy backend:
   ```bash
   cd backend
   modal deploy modal_app.py
   ```
6. [ ] Note the deployment URL
7. [ ] Test endpoint:
   ```bash
   curl -X POST https://your-modal-url/univfd \
     -H "X-API-Key: your-secret-key" \
     -F "file=@test-image.jpg"
   ```

### Backend Verification
- [ ] Endpoint responds correctly
- [ ] Authentication works
- [ ] CLIP model loads
- [ ] UnivFD model loads (if available)
- [ ] Error handling works

---

## Frontend Deployment

### Environment Setup
1. [ ] Create `.env.production` file:
   ```
   VITE_DEEPFAKE_API_KEY=your-secret-key-here
   VITE_MODAL_URL=https://your-modal-url
   ```

### Build
2. [ ] Run production build:
   ```bash
   npm run build
   ```
3. [ ] Test build locally:
   ```bash
   npm run preview
   ```
4. [ ] Verify all features work

### Hosting Options

#### Option A: Vercel
```bash
npm install -g vercel
vercel login
vercel --prod
```

#### Option B: Netlify
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

#### Option C: GitHub Pages
```bash
# Add to package.json:
"homepage": "https://yourusername.github.io/repo-name"

# Build and deploy:
npm run build
npx gh-pages -d dist
```

### Frontend Verification
- [ ] App loads correctly
- [ ] All pages accessible
- [ ] Image detection works
- [ ] Video detection works
- [ ] Webcam detection works
- [ ] Settings persist
- [ ] Exports work
- [ ] Performance panel works
- [ ] Diagnostics show correct info

---

## Post-Deployment Testing

### Functional Tests
- [ ] Upload and analyze test image
- [ ] Upload and analyze test video
- [ ] Use webcam detection
- [ ] Enable all research features
- [ ] Enable defensive transforms
- [ ] Export reports (JSON & CSV)
- [ ] Check audit logs
- [ ] View performance metrics

### Performance Tests
- [ ] Measure detection time
- [ ] Check memory usage
- [ ] Test on slow connection
- [ ] Test on mobile device
- [ ] Verify model caching works

### Security Tests
- [ ] API key required for backend
- [ ] No sensitive data in console
- [ ] HTTPS enabled
- [ ] CORS configured correctly

---

## Monitoring Setup

### Analytics (Optional)
- [ ] Add Google Analytics
- [ ] Add error tracking (Sentry)
- [ ] Add performance monitoring

### Logging
- [ ] Backend logs accessible
- [ ] Frontend errors logged
- [ ] Audit logs working

---

## Documentation Updates

### User Documentation
- [ ] Update README with deployment URL
- [ ] Add usage instructions
- [ ] Include example images/videos
- [ ] Document known limitations

### Developer Documentation
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Contribution guidelines
- [ ] Troubleshooting guide

---

## Final Verification

### Smoke Tests
1. [ ] Visit deployed URL
2. [ ] Upload test image → Should detect correctly
3. [ ] Check Settings → All options work
4. [ ] View Diagnostics → Shows correct status
5. [ ] Export report → Downloads correctly
6. [ ] Check Performance → Shows metrics

### Cross-Browser Testing
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browsers

### Performance Benchmarks
- [ ] Image detection: < 2s
- [ ] Video detection: < 5s per second of video
- [ ] Webcam: > 5 FPS
- [ ] Memory: < 200MB

---

## Rollback Plan

### If Issues Found
1. [ ] Document the issue
2. [ ] Revert to previous deployment
3. [ ] Fix issue locally
4. [ ] Test thoroughly
5. [ ] Redeploy

### Backup
- [ ] Keep previous build in `dist-backup/`
- [ ] Tag git commit before deployment
- [ ] Document deployment date/time

---

## Success Criteria

### Must Have ✅
- [x] All features working
- [x] Tests passing
- [x] Build successful
- [x] Documentation complete

### Should Have
- [ ] Deployed and accessible
- [ ] Performance acceptable
- [ ] No critical bugs
- [ ] User feedback positive

### Nice to Have
- [ ] Analytics setup
- [ ] Monitoring active
- [ ] Mobile optimized
- [ ] Accessibility tested

---

## Next Steps After Deployment

1. **Announce**: Share with users/stakeholders
2. **Monitor**: Watch for errors and performance issues
3. **Iterate**: Collect feedback and improve
4. **Document**: Update docs based on real usage
5. **Optimize**: Improve based on metrics

---

## Support & Maintenance

### Regular Tasks
- [ ] Check error logs weekly
- [ ] Review performance metrics
- [ ] Update dependencies monthly
- [ ] Backup audit logs
- [ ] Monitor API usage

### Emergency Contacts
- Backend: Modal support
- Frontend: Hosting provider support
- Code: GitHub issues

---

## Completion

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Deployment URL**: _______________  
**Backend URL**: _______________  

**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

**Notes**:
- Keep this checklist updated
- Document any issues encountered
- Share learnings with team
- Celebrate success! 🎉
