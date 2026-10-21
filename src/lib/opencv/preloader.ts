/**
 * OpenCV Preloader
 * 
 * Preloads OpenCV.js early in the app lifecycle to avoid delays during detection
 */

declare const cv: any;

let opencvLoadPromise: Promise<void> | null = null;
let opencvLoaded = false;

/**
 * Start preloading OpenCV.js
 * Call this early in the app lifecycle (e.g., in main.tsx or App.tsx)
 */
export const preloadOpenCV = (): Promise<void> => {
  if (opencvLoaded) {
    return Promise.resolve();
  }

  if (opencvLoadPromise) {
    return opencvLoadPromise;
  }

  opencvLoadPromise = new Promise((resolve, reject) => {
    console.log('🔄 Starting OpenCV.js preload...');
    console.log('   Loading from: https://docs.opencv.org/4.x/opencv.js');
    
    if (typeof cv !== 'undefined' && cv.Mat) {
      console.log('✅ OpenCV.js already loaded');
      opencvLoaded = true;
      resolve();
      return;
    }

    const startTime = Date.now();
    const timeout = 60000; // 60 seconds (increased from 30s)
    
    const checkInterval = setInterval(() => {
      if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(checkInterval);
        const loadTime = Date.now() - startTime;
        console.log(`✅ OpenCV.js preloaded successfully in ${loadTime}ms`);
        console.log(`   OpenCV version: ${cv.getBuildInformation ? 'Available' : 'Unknown'}`);
        opencvLoaded = true;
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        const elapsed = Date.now() - startTime;
        console.error(`❌ OpenCV.js preload timeout after ${elapsed}ms`);
        console.error('   This may be due to slow network or CORS issues');
        console.error('   Face alignment will use MediaPipe fallback');
        // Don't reject - allow fallback
        resolve(); // Resolve instead of reject to continue without OpenCV
      }
    }, 100);
  });

  return opencvLoadPromise;
};

/**
 * Check if OpenCV is loaded
 */
export const isOpenCVLoaded = (): boolean => {
  return opencvLoaded || (typeof cv !== 'undefined' && cv.Mat);
};

/**
 * Get the OpenCV load promise (for awaiting)
 */
export const getOpenCVLoadPromise = (): Promise<void> => {
  if (opencvLoaded) {
    return Promise.resolve();
  }
  
  if (!opencvLoadPromise) {
    return preloadOpenCV();
  }
  
  return opencvLoadPromise;
};
