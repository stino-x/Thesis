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
    
    if (typeof cv !== 'undefined' && cv.Mat) {
      console.log('✅ OpenCV.js already loaded');
      opencvLoaded = true;
      resolve();
      return;
    }

    const startTime = Date.now();
    const timeout = 30000; // 30 seconds
    
    const checkInterval = setInterval(() => {
      if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(checkInterval);
        const loadTime = Date.now() - startTime;
        console.log(`✅ OpenCV.js preloaded successfully in ${loadTime}ms`);
        opencvLoaded = true;
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        console.error('❌ OpenCV.js preload timeout');
        reject(new Error('OpenCV.js failed to preload'));
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
