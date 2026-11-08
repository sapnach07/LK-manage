import test from 'node:test';
import assert from 'node:assert';
import {
  calculateTotalStrokeLength,
  isSignatureValid,
  Point,
  Stroke,
} from './signatureUtils.js';

test('calculateTotalStrokeLength sums distances between sequential points', () => {
  const stroke1: Stroke = [
    { x: 0, y: 0 },
    { x: 30, y: 0 }, // 30px
    { x: 30, y: 40 }, // 40px -> 70px
  ];
  assert.strictEqual(Math.round(calculateTotalStrokeLength([stroke1])), 70);
});

test('isSignatureValid rejects empty strokes', () => {
  const res = isSignatureValid([]);
  assert.strictEqual(res.valid, false);
});

test('isSignatureValid rejects tiny taps and too short drawings with exact message', () => {
  // A tiny dot or tiny twitch under min length
  const shortStroke: Stroke = [
    { x: 10, y: 10 },
    { x: 12, y: 12 },
    { x: 14, y: 13 },
  ];
  const res = isSignatureValid([shortStroke], 75);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.reason, 'Signature trop courte, recommencez');
});

test('isSignatureValid accepts realistic multi-stroke signature', () => {
  const stroke1: Stroke = [
    { x: 50, y: 100 },
    { x: 100, y: 70 },
    { x: 150, y: 120 },
    { x: 200, y: 90 },
  ];
  const stroke2: Stroke = [
    { x: 60, y: 110 },
    { x: 180, y: 110 },
  ];
  const res = isSignatureValid([stroke1, stroke2], 75);
  assert.strictEqual(res.valid, true);
});
