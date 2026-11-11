import { describe, expect, it } from 'vitest';
import { outputWidths, sliceRects, spriteLayout } from './layout.mjs';

describe('sliceRects', () => {
  it('maps quadrants to expressions in TL, TR, BL, BR order', () => {
    expect(sliceRects(2048, 2048).map((r) => [r.expression, r.left, r.top])).toEqual([
      ['neutral', 0, 0],
      ['pleased', 1024, 0],
      ['angry', 0, 1024],
      ['suspicious', 1024, 1024],
    ]);
  });

  it('covers every pixel of odd-sized sheets', () => {
    const rects = sliceRects(1001, 999);
    const area = rects.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(area).toBe(1001 * 999);
  });
});

describe('spriteLayout', () => {
  it('lays frames out in a near-square grid', () => {
    const layout = spriteLayout(10, 100, 150);
    expect(layout).toMatchObject({ columns: 4, rows: 3, width: 400, height: 450 });
    expect(layout.frames[5]).toEqual({ x: 100, y: 150, w: 100, h: 150 });
  });

  it('respects maxColumns and rejects empty sprites', () => {
    expect(spriteLayout(100, 10, 10, 8).columns).toBe(8);
    expect(() => spriteLayout(0, 10, 10)).toThrow();
  });
});

describe('outputWidths', () => {
  it('never upscales, and flags a short 2x', () => {
    expect(outputWidths(220, 1024)).toEqual({ oneX: 220, twoX: 440, twoXIsShort: false });
    expect(outputWidths(1920, 2048)).toEqual({ oneX: 1920, twoX: 2048, twoXIsShort: true });
  });
});
