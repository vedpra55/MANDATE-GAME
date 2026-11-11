/**
 * Size rules for GPT-Image-2.6 custom sizes (OpenAI image generation guide, read 2026-11-11):
 * WIDTHxHEIGHT, both multiples of 16, aspect ratio between 1:3 and 3:1, no edge over 3840 px,
 * total pixels between 655,360 and 8,294,400. "auto" is also accepted.
 */
export const MIN_PIXELS = 655_360;
export const MAX_PIXELS = 8_294_400;
export const MAX_EDGE = 3840;

/** @returns {{ width: number, height: number }} */
export function parseSize(size) {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) throw new Error(`size must look like 1024x1024, got "${size}"`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** @returns {string | null} an error message, or null if the size is valid */
export function sizeError(size) {
  if (size === 'auto') return null;
  let width;
  let height;
  try {
    ({ width, height } = parseSize(size));
  } catch (err) {
    return err.message;
  }
  if (width % 16 !== 0 || height % 16 !== 0) return `${size}: both edges must be multiples of 16`;
  if (width > MAX_EDGE || height > MAX_EDGE) return `${size}: no edge may exceed ${MAX_EDGE}px`;
  const ratio = width / height;
  if (ratio > 3 || ratio < 1 / 3) return `${size}: aspect ratio must be between 1:3 and 3:1`;
  const pixels = width * height;
  if (pixels < MIN_PIXELS || pixels > MAX_PIXELS) {
    return `${size}: total pixels must be between ${MIN_PIXELS} and ${MAX_PIXELS} (got ${pixels})`;
  }
  return null;
}
