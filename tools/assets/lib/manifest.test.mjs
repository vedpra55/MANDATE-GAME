import { describe, expect, it } from 'vitest';
import { loadManifest, parseManifest, resolveAsset, selectAssets } from './manifest.mjs';

const defaults = {
  model: 'gpt-image-2.6-flare',
  quality: 'medium',
  variants: 4,
  styleBlockFile: 'style-block.txt',
  references: ['references'],
};

const asset = (over = {}) => ({
  id: 'prop.phone',
  category: 'props',
  description: 'An old rotary phone seen from above.',
  size: '1024x1024',
  background: 'transparent',
  displayWidth: 220,
  ...over,
});

const manifest = (assets) => ({ version: 1, defaults, assets });

describe('manifest', () => {
  it('the committed manifest.json is valid', async () => {
    const m = await loadManifest();
    expect(m.assets.length).toBeGreaterThan(0);
  });

  it('fills kind and status defaults', () => {
    const [a] = parseManifest(manifest([asset()])).assets;
    expect(a.kind).toBe('image');
    expect(a.status).toBe('todo');
  });

  it('names the asset in error messages', () => {
    expect(() => parseManifest(manifest([asset({ size: '1000x1000' })]))).toThrow(
      /prop\.phone \(size\): .*multiples of 16/,
    );
  });

  it('rejects duplicate ids', () => {
    expect(() => parseManifest(manifest([asset(), asset()]))).toThrow(/duplicate id/);
  });

  it('requires a picked variant for picked/final status', () => {
    expect(() => parseManifest(manifest([asset({ status: 'picked' })]))).toThrow(
      /requires "picked"/,
    );
    expect(() => parseManifest(manifest([asset({ status: 'picked', picked: 2 })]))).not.toThrow();
  });

  it('rejects bad ids', () => {
    expect(() => parseManifest(manifest([asset({ id: 'Prop Phone' })]))).toThrow(/lowercase/);
  });

  it('asset settings override defaults', () => {
    const m = parseManifest(manifest([asset({ model: 'gpt-image-2.6-sunburst' })]));
    const r = resolveAsset(m, m.assets[0]);
    expect(r.model).toBe('gpt-image-2.6-sunburst');
    expect(r.variants).toBe(4);
  });

  it('selects by id or by status, and errors on unknown ids', () => {
    const m = parseManifest(manifest([asset(), asset({ id: 'prop.tin', status: 'generated' })]));
    expect(selectAssets(m, { statuses: ['todo'] }).map((a) => a.id)).toEqual(['prop.phone']);
    expect(selectAssets(m, { only: ['prop.tin'] }).map((a) => a.id)).toEqual(['prop.tin']);
    expect(() => selectAssets(m, { only: ['nope'] })).toThrow(/unknown asset/);
  });
});
