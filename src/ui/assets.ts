/** Game-ready art from src/assets, looked up by file base name (e.g. "prop-phone"). */
const files = import.meta.glob<string>('../assets/**/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byName = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  byName.set(path.split('/').pop()!.replace('.webp', ''), url);
}

export type ArtSource = { src: string; srcSet: string };

export function art(name: string): ArtSource {
  const src = byName.get(name);
  if (!src) throw new Error(`missing art: ${name}`);
  const twoX = byName.get(`${name}@2x`);
  return { src, srcSet: twoX ? `${src} 1x, ${twoX} 2x` : src };
}
