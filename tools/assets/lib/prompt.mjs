import { EXPRESSIONS } from './manifest.mjs';

/**
 * Prompt template (fixed by the brief): [STYLE BLOCK] + [ASSET DESCRIPTION] + [TECHNICAL SPEC].
 * The style block lives in a text file so every asset shares exactly the same wording.
 */

export const PLACEHOLDER_MARKER = 'PLACEHOLDER';

/** Banned elements that apply to every asset, whatever the style (CLAUDE.md §7 and §9). */
export const ALWAYS_BANNED = [
  'no real politicians or recognisable real people',
  'no political party symbols or emblems of any kind (no painted, printed or flag emblem of a lotus, hand, broom, elephant, lantern, bicycle or similar); ordinary everyday objects such as a real bicycle are fine',
  'no real party flag colour combinations',
  'no logos, watermarks or signatures',
];

/** Lines starting with "#" are comments for humans and are not sent to the model. */
export function cleanStyleBlock(text) {
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
    .trim();
}

export function isPlaceholderStyle(text) {
  return text.includes(PLACEHOLDER_MARKER) || cleanStyleBlock(text).length === 0;
}

export function buildTechnicalSpec(asset) {
  const lines = [];
  if (asset.kind === 'character-sheet') {
    const [tl, tr, bl, br] = EXPRESSIONS;
    lines.push(
      'Character expression sheet: a 2x2 grid of four equal quadrants showing the SAME character,',
      'chest-up, three-quarter view, identical outfit, hair, lighting and framing in every quadrant.',
      `Top-left: ${tl}. Top-right: ${tr}. Bottom-left: ${bl}. Bottom-right: ${br}.`,
      'Each face centred in its quadrant with margin; nothing crosses quadrant edges; no borders, gutters or labels.',
    );
  } else if (asset.category === 'scenes') {
    lines.push('Full illustrated scene, composed edge to edge.');
  } else if (asset.category === 'textures') {
    lines.push('Seamless tileable texture, even lighting, no focal point, no objects.');
  } else {
    lines.push(
      'A single isolated object, fully in frame with a small margin, nothing else in the image.',
    );
  }

  if (asset.background === 'transparent') {
    lines.push(
      'Fully transparent background; no floor, no backdrop, no cast shadow on the background.',
    );
  } else if (asset.kind === 'character-sheet') {
    lines.push('Plain flat, even, light background in every quadrant.');
  }

  lines.push(`Canvas ${asset.size}.`);
  lines.push(
    'No text, letters or numbers anywhere unless the description explicitly asks for them.',
  );
  lines.push(`Banned: ${ALWAYS_BANNED.join('; ')}.`);
  if (asset.spec) lines.push(asset.spec.trim());
  return lines.join('\n');
}

export function buildPrompt(styleBlockText, asset) {
  return [
    'STYLE:',
    cleanStyleBlock(styleBlockText),
    '',
    'SUBJECT:',
    asset.description.trim(),
    '',
    'TECHNICAL:',
    buildTechnicalSpec(asset),
  ].join('\n');
}
