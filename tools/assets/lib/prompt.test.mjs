import { describe, expect, it } from 'vitest';
import { buildPrompt, buildTechnicalSpec, cleanStyleBlock, isPlaceholderStyle } from './prompt.mjs';

const base = {
  id: 'x',
  category: 'props',
  kind: 'image',
  description: 'An old rotary phone.',
  size: '1024x1024',
  background: 'opaque',
};

describe('prompt', () => {
  it('orders use, subject, style, constraints and strips comment lines', () => {
    const prompt = buildPrompt('# note to self\nFlat colour, thick lines.', base);
    expect(prompt).not.toContain('note to self');
    const order = [
      'Intended use:',
      'Subject:',
      'An old rotary phone.',
      'Style:',
      'Flat colour',
      'Constraints:',
    ].map((s) => prompt.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('always includes the banned-elements line', () => {
    expect(buildTechnicalSpec(base)).toMatch(/party symbols/);
    expect(buildTechnicalSpec(base)).toMatch(/real politicians/);
  });

  it('describes transparency and character sheets', () => {
    expect(buildTechnicalSpec({ ...base, background: 'transparent' })).toMatch(
      /transparent background/,
    );
    const sheet = buildTechnicalSpec({ ...base, category: 'characters', kind: 'character-sheet' });
    expect(sheet).toMatch(
      /Top-left: neutral\. Top-right: pleased\. Bottom-left: angry\. Bottom-right: suspicious\./,
    );
  });

  it('appends extra spec text', () => {
    expect(buildTechnicalSpec({ ...base, spec: 'Warm light from top-left.' })).toMatch(
      /Warm light from top-left\.$/,
    );
  });

  it('detects placeholder style blocks', () => {
    expect(isPlaceholderStyle('# PLACEHOLDER: write me')).toBe(true);
    expect(isPlaceholderStyle('# only comments')).toBe(true);
    expect(isPlaceholderStyle('Flat colour.')).toBe(false);
    expect(cleanStyleBlock('  # c\nA\n')).toBe('A');
  });
});
