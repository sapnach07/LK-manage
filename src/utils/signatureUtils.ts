/**
 * Signature utilities:
 * - Smoothing curves (Bézier quadratic or Catmull-Rom)
 * - Stroke distance measurement & validation (rejecting too short/empty signatures)
 * - Transparent PNG cropping & bounding-box proportional trim
 */

export interface Point {
  x: number;
  y: number;
}

export type Stroke = Point[];

/**
 * Calculates the total path length across all strokes in pixels.
 */
export function calculateTotalStrokeLength(strokes: Stroke[]): number {
  let totalLength = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const p1 = stroke[i - 1];
      const p2 = stroke[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
  }
  return totalLength;
}

/**
 * Validates whether the strokes represent a legitimate signature.
 * Requires at least a minimum total stroke length (e.g. 70px) and a non-trivial bounding box.
 */
export function isSignatureValid(
  strokes: Stroke[],
  minStrokeLength: number = 75,
  minDimension: number = 18
): { valid: boolean; reason?: string } {
  if (!strokes || strokes.length === 0) {
    return { valid: false, reason: 'Signature vide, veuillez signer.' };
  }

  const totalLength = calculateTotalStrokeLength(strokes);
  if (totalLength < minStrokeLength) {
    return { valid: false, reason: 'Signature trop courte, recommencez' };
  }

  // Check bounding box to prevent tapping dots
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let totalPoints = 0;

  for (const stroke of strokes) {
    totalPoints += stroke.length;
    for (const p of stroke) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (totalPoints < 6) {
    return { valid: false, reason: 'Signature trop courte, recommencez' };
  }

  const width = maxX - minX;
  const height = maxY - minY;

  if (width < minDimension && height < minDimension) {
    return { valid: false, reason: 'Signature trop courte, recommencez' };
  }

  return { valid: true };
}

/**
 * Draws smooth curves between points onto a 2D canvas context.
 * Uses quadratic curves between midpoints for natural, fluid ink.
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  strokeStyle: string = '#000000',
  lineWidth: number = 3
) {
  if (stroke.length === 0) return;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.length === 1) {
    // Single dot
    ctx.beginPath();
    ctx.arc(stroke[0].x, stroke[0].y, lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = strokeStyle;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (stroke.length === 2) {
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    ctx.lineTo(stroke[1].x, stroke[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke[0].x, stroke[0].y);

  for (let i = 1; i < stroke.length - 1; i++) {
    const xc = (stroke[i].x + stroke[i + 1].x) / 2;
    const yc = (stroke[i].y + stroke[i + 1].y) / 2;
    ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, xc, yc);
  }

  // For the last segment
  const lastIndex = stroke.length - 1;
  ctx.lineTo(stroke[lastIndex].x, stroke[lastIndex].y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Redraws all strokes onto a given canvas context.
 */
export function redrawAllStrokes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strokes: Stroke[],
  strokeStyle: string = '#000000',
  lineWidth: number = 3
) {
  ctx.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    drawStroke(ctx, stroke, strokeStyle, lineWidth);
  }
}

/**
 * Crops a transparent PNG around the drawn strokes bounding box (with optional padding)
 * preserving exact proportions, without distortion.
 * Output is a clean transparent PNG data URL with black stroke.
 */
export function exportCroppedTransparentSignaturePng(
  strokes: Stroke[],
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 16,
  targetMaxWidth: number = 600,
  targetMaxHeight: number = 240
): string | null {
  if (strokes.length === 0) return null;

  // 1. Calculate bounding box of all points
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const p of stroke) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (minX === Infinity) return null;

  // Add padding while clamping to original canvas bounds
  const strokeMargin = 4; // safety for stroke width
  const bMinX = Math.max(0, minX - padding - strokeMargin);
  const bMaxX = Math.min(canvasWidth, maxX + padding + strokeMargin);
  const bMinY = Math.max(0, minY - padding - strokeMargin);
  const bMaxY = Math.min(canvasHeight, maxY + padding + strokeMargin);

  const cropWidth = Math.max(10, bMaxX - bMinX);
  const cropHeight = Math.max(10, bMaxY - bMinY);

  // Compute scaled dimensions preserving aspect ratio
  const scale = Math.min(1, targetMaxWidth / cropWidth, targetMaxHeight / cropHeight);
  const destWidth = Math.round(cropWidth * (scale > 0 ? scale : 1));
  const destHeight = Math.round(cropHeight * (scale > 0 ? scale : 1));

  // Render on an off-screen canvas with transparent background
  const offCanvas = document.createElement('canvas');
  offCanvas.width = destWidth;
  offCanvas.height = destHeight;
  const offCtx = offCanvas.getContext('2d');
  if (!offCtx) return null;

  // Transparent background (do not fill with white)
  offCtx.clearRect(0, 0, destWidth, destHeight);

  // Scale and translate context so cropped area fills dest
  offCtx.scale(destWidth / cropWidth, destHeight / cropHeight);
  offCtx.translate(-bMinX, -bMinY);

  // Redraw strokes into cropped transparent canvas with smooth curves and crisp black ink
  for (const stroke of strokes) {
    drawStroke(offCtx, stroke, '#000000', 3.5);
  }

  return offCanvas.toDataURL('image/png');
}
