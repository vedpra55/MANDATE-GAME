import { describe, expect, it } from 'vitest';
import { parseSize, sizeError } from './sizes.mjs';

describe('sizeError', () => {
  it.each(['1024x1024', '2048x1152', '2048x2048', '1024x1536', '3840x2160', 'auto'])(
    'accepts %s',
    (s) => {
      expect(sizeError(s)).toBeNull();
    },
  );

  it.each([
    ['1000x1000', /multiples of 16/],
    ['4096x1024', /3840/],
    ['3200x1024', /aspect ratio/],
    ['512x512', /total pixels/],
    ['big', /look like/],
  ])('rejects %s', (s, message) => {
    expect(sizeError(s)).toMatch(message);
  });

  it('parses width and height', () => {
    expect(parseSize('2048x1152')).toEqual({ width: 2048, height: 1152 });
  });
});
