# Declaration on the Use of AI Tools

**Student Name:** Augustine Iheagwara  
**Thesis Title:** Deepfake Detection System  
**Program:** [BSc/MSc] in Computer Science  
**Supervisor:** [Agocs Noemi]  
**Date:** April 26, 2026

---

## Declaration

I, Augustine Iheagwara, declare that:

- I take full responsibility for the content of the submitted work
- I am familiar with the concept of plagiarism and Sections 74/A–E of the Academic and Examination Regulations (HKR)
- I am familiar with Dean's Instruction 1/2026 (III.26.) on the Use of AI in Education, Research, and Administration
- I have only used the AI tools listed in the table below
- I have not copied AI-generated text or code without verification and proper citation
- I will retain the complete AI usage log on the platform until evaluation is complete, and present it upon request

I acknowledge that:

- Directly copying AI-generated content as my own work, or failing to document AI usage, is equivalent to plagiarism
- My submission may be checked with plagiarism detection software after submission
- In case of suspected plagiarism, the supervisor may verify orally or in writing that results reflect my own knowledge
- In case of plagiarism, my thesis/diploma work cannot be evaluated and disciplinary proceedings may be initiated


---

## AI Usage Documentation

| Purpose of Use | Method of Use | AI Tool Used | Part of Work |
|---|---|---|---|
| Project scaffolding and initial setup | Generated basic React + TypeScript + Vite structure, reviewed and customized for project needs | GitHub Copilot, ChatGPT-4 | Initial project setup, configuration files |
| Understanding ONNX Runtime Web API | Asked for explanations and examples, then adapted to my specific model loading requirements | ChatGPT-4 | `src/lib/onnx/onnxDetector.ts` - model loading logic |
| TensorFlow.js model integration | Requested help with model loading syntax, verified preprocessing matched model requirements | GitHub Copilot | `src/lib/tensorflow/detector.ts` - TF.js integration |
| MediaPipe API learning | Asked for API usage examples, implemented face detection and mesh analysis myself | ChatGPT-4 | `src/lib/mediapipe/` - face detection implementation |
| Ensemble algorithm implementation | Designed ensemble strategy myself, used AI to help implement weighted averaging correctly | GitHub Copilot | `src/lib/tensorflow/detector.ts` - ensemble logic |
| PPG analysis implementation | Read Intel FakeCatcher paper myself, used AI to help with signal processing code | ChatGPT-4, GitHub Copilot | `src/lib/physiological/ppgAnalyzer.ts` |
| Confidence calibration | Understood Platt scaling from ML coursework, used AI for TypeScript implementation | GitHub Copilot | `src/lib/calibration/confidenceCalibrator.ts` |
| Adversarial detection | Designed FFT-based approach from papers, used AI for FFT implementation in JavaScript | ChatGPT-4 | `src/lib/adversarial/adversarialDetector.ts` |
| UI component generation | Used shadcn/ui components (AI-friendly), customized significantly for project needs | GitHub Copilot | `src/components/ui/` - UI components |
| Code debugging | Asked for help interpreting ONNX Runtime and WebAssembly errors, tested solutions myself | ChatGPT-4 | Various files - debugging sessions |
| Test case generation | Generated initial test structure, reviewed and modified to test actual requirements | GitHub Copilot | `src/lib/**/__tests__/` - unit tests |
| Initial documentation | Generated comprehensive documentation structure | ChatGPT-4 | `docs/` - initial documentation files |
| Documentation rewrite | Rewrote AI-generated docs in my own voice after feedback | Self-written | User and Developer documentation for thesis |
| Code comments | Some inline comments suggested by Copilot, reviewed and modified for accuracy | GitHub Copilot | Throughout codebase - inline comments |


---

## Detailed Explanation

### Development Process

**System Architecture and Design:**
The overall system architecture - using multiple models in a grouped ensemble, adding multi-modal signals, and implementing research features - was my own design based on reading deepfake detection research papers. AI tools did not contribute to these design decisions.

**Implementation:**
For implementation, I used GitHub Copilot and ChatGPT-4 as coding assistants. Copilot provided autocomplete suggestions while I was writing code. ChatGPT helped me understand unfamiliar APIs (ONNX Runtime Web, MediaPipe) and debug complex errors.

**Critical Verification:**
Every piece of AI-generated code was:
1. Read and understood before accepting
2. Tested with various inputs
3. Verified against documentation and requirements
4. Modified when needed to fit my specific use case
5. Commented to explain the logic

**Research and Learning:**
I read the following research papers myself without AI assistance:
- "On Calibration of Modern Neural Networks" (Guo et al., 2017) - for confidence calibration
- "Explaining and Harnessing Adversarial Examples" (Goodfellow et al., 2015) - for adversarial detection
- "Face X-ray for More General Face Forgery Detection" (Li et al., 2020) - for partial localization
- Intel FakeCatcher paper - for PPG analysis

I used ChatGPT to help understand complex mathematical concepts from these papers, but I verified my understanding by implementing the algorithms and testing them.

### Documentation

**Initial Documentation:**
I initially used ChatGPT-4 to generate comprehensive documentation. This was clearly AI-generated with formal tone, excessive structure, and tutorial-like style.

**Revised Documentation:**
After receiving feedback that the documentation was too AI-generated, I rewrote the user and developer documentation in my own voice based on my actual understanding and experience with the project.

**Technical Documentation:**
Some detailed technical documentation retains more AI-generated structure, but I reviewed every technical detail to ensure accuracy and understanding.

### What I Can Defend

I can explain and defend:
- Why I chose each model and how they complement each other
- How the grouped ensemble voting works and why it's better than flat averaging
- The theory behind confidence calibration, adversarial detection, and partial localization
- Every design decision and trade-off I made
- The limitations of the system and why they exist
- How each part of the code works

I could rebuild this system from scratch without AI assistance, though it would take longer.

---

## AI Interaction Logs

Complete interaction logs with ChatGPT-4 are retained in my ChatGPT account history and available upon request. GitHub Copilot suggestions are logged in my IDE history.

**ChatGPT conversation links:** [Available upon request]  
**GitHub Copilot usage period:** [Start date] - [End date]

---

## Signature

**Student Signature:** ___________________________  
**Date:** ___________________________

---

**Note:** This declaration is submitted in accordance with Dean's Instruction 1/2026 (III.26.) on the Use of AI in Education, Research, and Administration at ELTE Faculty of Informatics.
