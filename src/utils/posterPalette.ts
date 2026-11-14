export interface PosterPalette {
  primary: string;
  secondary: string;
  highlight: string;
}

const DEFAULT_GRADIENTS: [string, string][] = [
  ['#d4884a', '#572d16'],
  ['#4f79d4', '#162552'],
  ['#aeb88f', '#3d4c37'],
  ['#cf728b', '#4d2236'],
  ['#7bb3b0', '#234a50'],
  ['#9e83d4', '#392869'],
];

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => clampByte(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  h /= 6;
  return [h * 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = (((h % 360) + 360) % 360) / 360;
  if (s <= 0) {
    const v = clampByte(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    clampByte(hue2rgb(p, q, hn + 1 / 3) * 255),
    clampByte(hue2rgb(p, q, hn) * 255),
    clampByte(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

function tuneAmbientHex(r: number, g: number, b: number, targetMinL = 0.34, targetMaxL = 0.66): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  const tunedL = Math.max(targetMinL, Math.min(targetMaxL, l));
  const tunedS = s > 0.08 ? Math.max(0.32, Math.min(0.84, s * 1.12)) : s;
  const [tr, tg, tb] = hslToRgb(h, tunedS, tunedL);
  return rgbToHex(tr, tg, tb);
}

/**
 * Extracts a harmonious 3-color ambient palette from raw RGBA image pixel data.
 * Groups pixels by 30-degree hue buckets and prefers vibrant, well-exposed colors
 * while falling back cleanly for monochrome or dark artwork.
 */
export function extractPaletteFromPixels(rgba: ArrayLike<number>): PosterPalette | null {
  if (!rgba || rgba.length < 4) return null;

  interface Bucket {
    weight: number;
    rSum: number;
    gSum: number;
    bSum: number;
  }

  const HUE_BUCKETS = 12;
  const buckets: Bucket[] = Array.from({ length: HUE_BUCKETS }, () => ({
    weight: 0,
    rSum: 0,
    gSum: 0,
    bSum: 0,
  }));

  let totalWeight = 0;
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 100) continue;

    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);

    // Avoid pure crushed black or blown-out white dominating the ambient wash
    const lWeight = l < 0.08 || l > 0.94 ? 0.2 : 1 - Math.abs(l - 0.5) * 0.65;
    const satWeight = 0.25 + s * 2.4;
    const w = lWeight * satWeight;

    totalWeight += w;
    avgR += r * w;
    avgG += g * w;
    avgB += b * w;

    if (s >= 0.14) {
      const idx = Math.floor((((h % 360) + 360) % 360) / 30) % HUE_BUCKETS;
      buckets[idx].weight += w;
      buckets[idx].rSum += r * w;
      buckets[idx].gSum += g * w;
      buckets[idx].bSum += b * w;
    }
  }

  if (totalWeight <= 0) return null;

  const ranked = buckets
    .map((b, idx) => ({ ...b, idx }))
    .filter((b) => b.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (ranked.length === 0) {
    const r = avgR / totalWeight;
    const g = avgG / totalWeight;
    const b = avgB / totalWeight;
    const primary = tuneAmbientHex(r, g, b, 0.36, 0.58);
    const [h, s, l] = rgbToHsl(r, g, b);
    const [sr, sg, sb] = hslToRgb(h + 24, Math.max(0.12, s), Math.max(0.28, l * 0.85));
    const [hr, hg, hb] = hslToRgb(h - 20, Math.max(0.14, s), Math.min(0.68, l * 1.18));
    return {
      primary,
      secondary: rgbToHex(sr, sg, sb),
      highlight: rgbToHex(hr, hg, hb),
    };
  }

  const pickColor = (b: Bucket) =>
    tuneAmbientHex(b.rSum / b.weight, b.gSum / b.weight, b.bSum / b.weight);

  const primaryBucket = ranked[0];
  const primary = pickColor(primaryBucket);

  // Pick secondary from a non-adjacent hue bucket when possible for visual depth
  const secondaryBucket =
    ranked.find((b) => {
      const dist = Math.abs(b.idx - primaryBucket.idx);
      const wrapDist = Math.min(dist, HUE_BUCKETS - dist);
      return wrapDist >= 2;
    }) || ranked[1];

  const highlightBucket =
    ranked.find((b) => b.idx !== primaryBucket.idx && b.idx !== secondaryBucket?.idx) ||
    ranked[1];

  const prgb = hexToRgb(primary) || [120, 120, 160];
  const [ph, ps, pl] = rgbToHsl(prgb[0], prgb[1], prgb[2]);

  const secondary = secondaryBucket
    ? pickColor(secondaryBucket)
    : (() => {
        const [sr, sg, sb] = hslToRgb(ph + 38, Math.max(0.32, ps * 0.9), Math.max(0.32, pl * 0.88));
        return rgbToHex(sr, sg, sb);
      })();

  const highlight = highlightBucket
    ? pickColor(highlightBucket)
    : (() => {
        const [hr, hg, hb] = hslToRgb(ph - 32, Math.min(0.85, ps * 1.05), Math.min(0.7, pl * 1.16));
        return rgbToHex(hr, hg, hb);
      })();

  return { primary, secondary, highlight };
}

export function deriveFallbackPalette(
  title: string,
  providedGradient?: [string, string]
): PosterPalette {
  let pair = providedGradient;
  if (!pair) {
    let hash = 0;
    for (let i = 0; i < title.length; i += 1) {
      hash = (hash * 31 + title.charCodeAt(i)) | 0;
    }
    pair = DEFAULT_GRADIENTS[Math.abs(hash) % DEFAULT_GRADIENTS.length];
  }

  const [fromHex, toHex] = pair;
  const fromRgb = hexToRgb(fromHex) || [180, 120, 90];
  const toRgb = hexToRgb(toHex) || [60, 45, 70];
  const [h, s, l] = rgbToHsl(fromRgb[0], fromRgb[1], fromRgb[2]);
  const [hr, hg, hb] = hslToRgb(h + 28, Math.min(0.85, Math.max(0.36, s)), Math.min(0.68, l * 1.1));

  return {
    primary: tuneAmbientHex(fromRgb[0], fromRgb[1], fromRgb[2]),
    secondary: tuneAmbientHex(toRgb[0], toRgb[1], toRgb[2], 0.3, 0.56),
    highlight: rgbToHex(hr, hg, hb),
  };
}
