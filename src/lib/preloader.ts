/**
 * Model Preloader
 * 
 * Preloads all ML models and dependencies early in the app lifecycle
 * to avoid delays during detection
 */

import { preloadOpenCV } from './opencv/preloader';
import { getDeepfakeDetector } from './tensorflow/detector';
import { getFaceDetector } from './mediapipe/faceDetection';
import { getFaceMesh } from './mediapipe/faceMesh';

let preloadPromise: Promise<void> | null = null;
let preloadComplete = false;

interface PreloadStatus {
  opencv: boolean;
  tensorflow: boolean;
  onnx: boolean;
  faceDetection: boolean;
  faceMesh: boolean;
}

const status: PreloadStatus = {
  opencv: false,
  tensorflow: false,
  onnx: false,
  faceDetection: false,
  faceMesh: false,
};

/**
 * Preload all models and dependencies
 */
export const preloadAllModels = (): Promise<void> => {
  if (preloadComplete) {
    return Promise.resolve();
  }

  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    console.log('🚀 Starting model preload...');
    const startTime = Date.now();

    try {
      // Start all preloads in parallel
      const results = await Promise.allSettled([
        // 1. OpenCV (needed for preprocessing)
        preloadOpenCV()
          .then(() => {
            status.opencv = true;
            console.log('✅ OpenCV preloaded');
          })
          .catch(err => {
            console.warn('⚠️  OpenCV preload failed:', err);
          }),

        // 2. TensorFlow.js + ONNX models (main detection models)
        (async () => {
          const detector = getDeepfakeDetector();
          await detector.waitForInitialization();
          status.tensorflow = true;
          status.onnx = true;
          console.log('✅ TensorFlow.js and ONNX models preloaded');
        })().catch(err => {
          console.warn('⚠️  TensorFlow/ONNX preload failed:', err);
        }),

        // 3. MediaPipe Face Detection
        (async () => {
          const faceDetector = getFaceDetector();
          await faceDetector.waitForInitialization();
          status.faceDetection = true;
          console.log('✅ MediaPipe Face Detection preloaded');
        })().catch(err => {
          console.warn('⚠️  Face Detection preload failed:', err);
        }),

        // 4. MediaPipe Face Mesh
        (async () => {
          const faceMesh = getFaceMesh();
          await faceMesh.waitForInitialization();
          status.faceMesh = true;
          console.log('✅ MediaPipe Face Mesh preloaded');
        })().catch(err => {
          console.warn('⚠️  Face Mesh preload failed:', err);
        }),
      ]);

      const loadTime = Date.now() - startTime;
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      console.log(`✅ Model preload complete: ${successCount}/4 systems loaded in ${loadTime}ms`);
      console.log('📊 Preload status:', status);
      
      preloadComplete = true;
    } catch (error) {
      console.error('❌ Model preload error:', error);
      throw error;
    }
  })();

  return preloadPromise;
};

/**
 * Get preload status
 */
export const getPreloadStatus = (): PreloadStatus => {
  return { ...status };
};

/**
 * Check if preload is complete
 */
export const isPreloadComplete = (): boolean => {
  return preloadComplete;
};

/**
 * Get the preload promise (for awaiting)
 */
export const getPreloadPromise = (): Promise<void> => {
  if (preloadComplete) {
    return Promise.resolve();
  }
  
  if (!preloadPromise) {
    return preloadAllModels();
  }
  
  return preloadPromise;
};
