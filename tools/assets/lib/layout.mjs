import { EXPRESSIONS } from './manifest.mjs';

/** Crop rectangles for a 2×2 sheet, in EXPRESSIONS order (TL, TR, BL, BR). Odd pixels go to the right/bottom cells. */
export function sliceRects(width, height) {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const cells = [
    { left: 0, top: 0, width: halfW, height: halfH },
    { left: halfW, top: 0, width: width - halfW, height: halfH },
    { left: 0, top: halfH, width: halfW, height: height - halfH },
    { left: halfW, top: halfH, width: width - halfW, height: height - halfH },
  ];
  return EXPRESSIONS.map((expression, i) => ({ expression, ...cells[i] }));
}

/** Grid layout for a sprite sheet: near-square, at most `maxColumns` wide. */
export function spriteLayout(count, cellWidth, cellHeight, maxColumns = 8) {
  if (count < 1) throw new Error('sprite needs at least one frame');
  const columns = Math.min(maxColumns, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const frames = Array.from({ length: count }, (_, i) => ({
    x: (i % columns) * cellWidth,
    y: Math.floor(i / columns) * cellHeight,
    w: cellWidth,
    h: cellHeight,
  }));
  return { columns, rows, width: columns * cellWidth, height: rows * cellHeight, frames };
}

/** 1x and 2x output widths, never upscaling past the source. */
export function outputWidths(displayWidth, sourceWidth) {
  const oneX = Math.min(displayWidth, sourceWidth);
  const twoX = Math.min(displayWidth * 2, sourceWidth);
  return { oneX, twoX, twoXIsShort: twoX < displayWidth * 2 };
}
