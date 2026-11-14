import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveFallbackPalette,
  extractPaletteFromPixels,
  hexToRgb,
  rgbToHsl,
} from './posterPalette';

test('extractPaletteFromPixels extracts dominant saturated hues and skips transparent pixels', () => {
  const pixels: number[] = [];
  // 20 orange-red pixels
  for (let i = 0; i < 20; i += 1) pixels.push(230, 95, 55, 255);
  // 12 deep teal pixels (distinct hue bucket)
  for (let i = 0; i < 12; i += 1) pixels.push(35, 165, 190, 255);
  // 10 transparent pixels (ignored)
  for (let i = 0; i < 10; i += 1) pixels.push(0, 255, 0, 0);

  const palette = extractPaletteFromPixels(pixels);
  assert.ok(palette);
  const pRgb = hexToRgb(palette.primary);
  const sRgb = hexToRgb(palette.secondary);
  assert.ok(pRgb && sRgb);

  // Primary should be warm red-orange (R > B)
  assert.ok(pRgb[0] > pRgb[2]);
  // Secondary should be cool cyan-teal (B > R)
  assert.ok(sRgb[2] > sRgb[0]);
});

test('extractPaletteFromPixels handles monochrome / grayscale posters gracefully', () => {
  const pixels: number[] = [];
  for (let i = 0; i < 16; i += 1) pixels.push(95, 95, 95, 255);

  const palette = extractPaletteFromPixels(pixels);
  assert.ok(palette);
  assert.match(palette.primary, /^#[0-9a-f]{6}$/i);
  assert.match(palette.secondary, /^#[0-9a-f]{6}$/i);
  assert.match(palette.highlight, /^#[0-9a-f]{6}$/i);
});

test('extractPaletteFromPixels returns null on empty or fully transparent buffers', () => {
  assert.equal(extractPaletteFromPixels([]), null);
  assert.equal(extractPaletteFromPixels([255, 0, 0, 0, 0, 255, 0, 0]), null);
});

test('deriveFallbackPalette respects provided accentGradient and produces distinct tuned stops', () => {
  const palette = deriveFallbackPalette('Dune: Part Two', ['#d4884a', '#572d16']);
  assert.match(palette.primary, /^#[0-9a-f]{6}$/i);
  assert.match(palette.secondary, /^#[0-9a-f]{6}$/i);
  assert.match(palette.highlight, /^#[0-9a-f]{6}$/i);
  assert.notEqual(palette.primary, palette.highlight);

  const rgb = hexToRgb(palette.primary)!;
  const [h] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  // Warm amber hue around 20-40 degrees
  assert.ok(h >= 10 && h <= 55);
});
