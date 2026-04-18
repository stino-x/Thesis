# Documentation

## Guides

- [Quick Start](guides/QUICK-START.md) — get running in 5 minutes
- [Detection System Guide](guides/DETECTION-SYSTEM-GUIDE.md) — full technical reference for the detection pipeline
- [Developer Guide](guides/DEVELOPER_GUIDE.md) — codebase layout, adding models, deployment

## Implementation

- [Architecture Decisions](implementation/ARCHITECTURE-DECISIONS.md) — every major decision with reasoning
- [Multi-Modal Implementation](implementation/MULTI-MODAL-IMPLEMENTATION.md) — PPG, lip-sync, voice, ELA details

## Features

- [Audit Logs](features/AUDIT-LOGS-IMPLEMENTATION.md) — detection history with Supabase
- [OAuth Setup](features/OAUTH-SETUP.md) — Google/GitHub authentication

---

## Current State (April 2026)

The system is fully implemented and deployed. Key facts:

- 5 ML models running in-browser via TF.js + ONNX Runtime Web
- CLIP/UnivFD backend deployed to Modal.com (free, always-on)
- All three analyzers (image, video, webcam) wired to full ensemble
- Supabase auth + audit logging working
- Branch: `modelenhancement`

What still needs doing:
1. End-to-end testing with real deepfake samples
2. Commit untracked files (`backend/`, `scripts/`, `src/lib/api/`, `src/lib/onnx/`)
3. Performance profiling — 4 ONNX models loading simultaneously may be slow on low-end hardware
