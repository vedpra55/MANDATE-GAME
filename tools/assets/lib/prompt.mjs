import { EXPRESSIONS } from './manifest.mjs';

/**
 * Prompt = intended use + subject (per asset) + style block (shared file) + constraints (generated).
 * Same three parts as the brief's template, ordered as OpenAI's image prompting guide recommends.
 */

export const PLACEHOLDER_MARKER = 'PLACEHOLDER';

/** Banned elements that apply to every asset, whatever the style (CLAUDE.md §7 and §9). */
export const ALWAYS_BANNED = [
  'no real politicians or recognisable real people',
  'no political party symbols or emblems of any kind (no painted, printed or flag emblem of a lotus, hand, broom, elephant, lantern, bicycle or similar); ordinary everyday objects such as a real bicycle are fine',
  'no real party flag colour combinations',
  'no logos, watermarks or signatures',
  'original fictional people only',
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

const GAME =
  "MANDATE, a 2D desktop game about village politics in India, told through the objects on a politician's desk";

/** "Name the intended use" (OpenAI image prompting guide). */
export const INTENDED_USE = {
  scenes: `Background art for one screen of ${GAME}. Interactive props and live text are layered on top in code, so the image itself carries no text.`,
  props: `A single prop sprite for ${GAME}. It is placed on top of the desk background and animated in code.`,
  characters: `A character portrait for ${GAME}, shown chest-up beside dialogue.`,
  crowd: `One crowd figure sprite for a rally scene in ${GAME}; many are layered and animated in code.`,
  ui: `A UI element for ${GAME}, used as a physical object such as a stamp, paper card or pin.`,
  textures: `A tileable surface texture for ${GAME}.`,
};

export function buildTechnicalSpec(asset) {
  const lines = [];
  if (asset.kind === 'character-sheet') {
    const [tl, tr, bl, br] = EXPRESSIONS;
    lines.push(
      'Character expression sheet: a 2x2 grid of four equal quadrants showing the SAME character, chest-up, three-quarter view, identical outfit, hair, lighting and framing in every quadrant.',
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
      'Isolated on a fully transparent background: no scenery, no solid backdrop, no checkerboard, no cast shadow on the background.',
    );
  } else if (asset.kind === 'character-sheet') {
    lines.push('Plain flat, even, light background in every quadrant.');
  }

  lines.push(`Canvas ${asset.size}.`);
  lines.push(
    'No text, letters, numbers or signage anywhere unless the subject explicitly asks for them.',
  );
  lines.push(...ALWAYS_BANNED.map((b) => `${b[0].toUpperCase()}${b.slice(1)}.`));
  if (asset.spec) lines.push(asset.spec.trim());
  return lines.map((l) => `- ${l}`).join('\n');
}

/**
 * Labelled sections in the order OpenAI recommends (use → subject/scene → style → constraints).
 * The style block is the shared, never-changing part; the subject is per asset.
 */
export function buildPrompt(styleBlockText, asset) {
  return [
    `Intended use: ${INTENDED_USE[asset.category]}`,
    '',
    'Subject:',
    asset.description.trim(),
    '',
    'Style:',
    cleanStyleBlock(styleBlockText),
    '',
    'Constraints:',
    buildTechnicalSpec(asset),
  ].join('\n');
}
