/**
 * OpenCV Drawing Utilities
 * 
 * Utilities for drawing detection results on canvas using OpenCV
 */

declare const cv: any;

export interface DrawOptions {
  color?: number[];
  thickness?: number;
  radius?: number;
}

/**
 * Draw bounding box on Mat
 */
export const drawBox = (
  mat: any,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DrawOptions = {}
): void => {
  const color = options.color || [0, 255, 0, 255]; // Green
  const thickness = options.thickness || 2;
  
  const point1 = new cv.Point(x, y);
  const point2 = new cv.Point(x + width, y + height);
  const colorVec = new cv.Scalar(...color);
  
  cv.rectangle(mat, point1, point2, colorVec, thickness);
};

/**
 * Draw circle (for landmarks)
 */
export const drawCircle = (
  mat: any,
  x: number,
  y: number,
  options: DrawOptions = {}
): void => {
  const color = options.color || [255, 0, 0, 255]; // Red
  const radius = options.radius || 2;
  
  const center = new cv.Point(x, y);
  const colorVec = new cv.Scalar(...color);
  
  cv.circle(mat, center, radius, colorVec, -1);
};

/**
 * Draw line
 */
export const drawLine = (
  mat: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: DrawOptions = {}
): void => {
  const color = options.color || [0, 255, 0, 255];
  const thickness = options.thickness || 1;
  
  const point1 = new cv.Point(x1, y1);
  const point2 = new cv.Point(x2, y2);
  const colorVec = new cv.Scalar(...color);
  
  cv.line(mat, point1, point2, colorVec, thickness);
};

/**
 * Draw text
 */
export const drawText = (
  mat: any,
  text: string,
  x: number,
  y: number,
  options: DrawOptions = {}
): void => {
  const color = options.color || [255, 255, 255, 255];
  const thickness = options.thickness || 1;
  
  const point = new cv.Point(x, y);
  const colorVec = new cv.Scalar(...color);
  
  cv.putText(
    mat,
    text,
    point,
    cv.FONT_HERSHEY_SIMPLEX,
    0.6,
    colorVec,
    thickness
  );
};
