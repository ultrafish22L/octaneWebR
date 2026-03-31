/**
 * SEGA Presets — ~25 semantic vector presets for common artistic intents.
 *
 * Categories: mood (aligned with suggestLighting), artist, film, genre.
 * All labeled "industry-derived" — user-created presets get "user-created".
 * Future learning engine may auto-generate presets with source "learned".
 *
 * Design: data-only module, no side effects. Pure lookups.
 */

import type { SemanticPreset, PresetCategory } from './types';

// ── Seed Presets ────────────────────────────────────────────────────

export const PRESETS: SemanticPreset[] = [
  // ── Mood (aligned with suggestLighting moods) ─────────────────────
  {
    name: 'dramatic',
    category: 'mood',
    description: 'High contrast, hard shadows, intense energy',
    vector: { contrast: 0.7, arousal: 0.5, warmth: -0.2, key_direction: 0.4 },
    tags: ['dramatic', 'cinematic', 'intense', 'bold'],
    source: 'industry-derived',
  },
  {
    name: 'ethereal',
    category: 'mood',
    description: 'Soft warm backlight, dreamy atmosphere, gentle beauty',
    vector: {
      warmth: 0.5,
      atmosphere: 0.4,
      pleasure: 0.6,
      contrast: -0.3,
      key_direction: 0.6,
    },
    tags: ['ethereal', 'dreamy', 'magical', 'fairy', 'enchanted'],
    source: 'industry-derived',
  },
  {
    name: 'natural',
    category: 'mood',
    description: 'Balanced daylight, neutral colors, realistic',
    vector: { warmth: 0.1, contrast: 0.1, saturation: 0.2, groundedness: 0.5 },
    tags: ['natural', 'daylight', 'realistic', 'outdoor', 'sunny'],
    source: 'industry-derived',
  },
  {
    name: 'studio',
    category: 'mood',
    description: 'Clean 3-point lighting, neutral, controlled',
    vector: { contrast: 0.2, warmth: 0.0, saturation: 0.1, complexity: -0.3 },
    tags: ['studio', 'clean', 'controlled', 'professional', 'neutral'],
    source: 'industry-derived',
  },
  {
    name: 'noir',
    category: 'mood',
    description: 'Single hard light, deep blacks, high mystery',
    vector: {
      contrast: 0.9,
      warmth: -0.3,
      arousal: 0.4,
      atmosphere: 0.2,
      key_direction: 0.3,
    },
    tags: ['noir', 'dark', 'mystery', 'shadow', 'detective'],
    source: 'industry-derived',
  },
  {
    name: 'golden_hour',
    category: 'mood',
    description: 'Extreme warmth, low sun angle, long golden shadows',
    vector: {
      warmth: 0.9,
      contrast: 0.4,
      pleasure: 0.5,
      key_direction: 0.5,
      atmosphere: 0.2,
    },
    tags: ['golden hour', 'sunset', 'sunrise', 'magic hour', 'golden'],
    source: 'industry-derived',
  },
  {
    name: 'moonlit',
    category: 'mood',
    description: 'Cool blue key, warm practicals, very dark environment',
    vector: {
      warmth: -0.7,
      contrast: 0.6,
      arousal: -0.3,
      atmosphere: 0.3,
      intimacy: 0.2,
    },
    tags: ['moonlit', 'night', 'nocturnal', 'moonlight', 'nighttime'],
    source: 'industry-derived',
  },

  // ── Artist ────────────────────────────────────────────────────────
  {
    name: 'vermeer',
    category: 'artist',
    description: 'Warm side-lit intimacy with soft shadows, domestic tranquility',
    vector: {
      warmth: 0.6,
      contrast: 0.4,
      intimacy: 0.5,
      key_direction: 0.3,
      pleasure: 0.5,
      complexity: -0.2,
    },
    tags: ['vermeer', 'dutch master', 'old master', 'golden age', 'girl with pearl earring'],
    source: 'industry-derived',
  },
  {
    name: 'caravaggio',
    category: 'artist',
    description: 'Extreme chiaroscuro, single dramatic light source, theatrical',
    vector: {
      contrast: 0.9,
      warmth: 0.3,
      arousal: 0.7,
      key_direction: 0.4,
      atmosphere: -0.3,
    },
    tags: ['caravaggio', 'chiaroscuro', 'baroque', 'tenebrism'],
    source: 'industry-derived',
  },
  {
    name: 'hopper',
    category: 'artist',
    description: 'Isolated light pools, melancholic warmth, geometric emptiness',
    vector: {
      warmth: 0.4,
      contrast: 0.5,
      arousal: -0.5,
      complexity: -0.5,
      intimacy: -0.3,
    },
    tags: ['hopper', 'nighthawks', 'american realism', 'lonely', 'solitude'],
    source: 'industry-derived',
  },
  {
    name: 'kubrick',
    category: 'artist',
    description: 'Symmetrical, cold precision, clinical beauty, wide lenses',
    vector: {
      warmth: -0.4,
      contrast: 0.3,
      dominance: 0.4,
      saturation: 0.3,
      shot_scale: 0.3,
      complexity: 0.2,
    },
    tags: ['kubrick', 'symmetry', 'one-point perspective', 'clinical'],
    source: 'industry-derived',
  },
  {
    name: 'villeneuve',
    category: 'artist',
    description: 'Vast scale, muted desaturation, atmospheric grandeur',
    vector: {
      dominance: 0.8,
      saturation: -0.5,
      atmosphere: 0.5,
      contrast: 0.3,
      shot_scale: 0.6,
      arousal: 0.3,
    },
    tags: ['villeneuve', 'dune', 'arrival', 'blade runner 2049', 'epic scale'],
    source: 'industry-derived',
  },
  {
    name: 'fincher',
    category: 'artist',
    description: 'Dark desaturated palette, clinical precision, uneasy beauty',
    vector: {
      saturation: -0.6,
      contrast: 0.5,
      warmth: -0.4,
      arousal: 0.3,
      pleasure: -0.3,
      surface_detail: 0.3,
    },
    tags: ['fincher', 'dark', 'desaturated', 'se7en', 'zodiac', 'fight club'],
    source: 'industry-derived',
  },

  // ── Film ──────────────────────────────────────────────────────────
  {
    name: 'blade_runner',
    category: 'film',
    description: 'Neon-soaked cyberpunk, high saturation, hazy atmosphere, dark',
    vector: {
      saturation: 0.7,
      contrast: 0.6,
      warmth: -0.3,
      atmosphere: 0.6,
      arousal: 0.7,
      complexity: 0.5,
    },
    tags: ['blade runner', 'cyberpunk', 'neon', 'dystopian', 'sci-fi noir'],
    source: 'industry-derived',
  },
  {
    name: 'moonlight_film',
    category: 'film',
    description: 'Soft intimate lighting, warm-cool duality, emotional closeness',
    vector: {
      intimacy: 0.7,
      warmth: 0.2,
      contrast: 0.3,
      saturation: 0.4,
      arousal: -0.2,
      pleasure: 0.4,
    },
    tags: ['moonlight', 'intimate cinema', 'barry jenkins'],
    source: 'industry-derived',
  },
  {
    name: 'grand_budapest',
    category: 'film',
    description: 'Pastel palette, symmetrical, whimsical, high pleasure',
    vector: {
      saturation: 0.5,
      warmth: 0.3,
      pleasure: 0.8,
      complexity: 0.4,
      contrast: -0.2,
      arousal: 0.2,
    },
    tags: ['wes anderson', 'grand budapest', 'pastel', 'whimsical', 'symmetrical'],
    source: 'industry-derived',
  },
  {
    name: 'mad_max',
    category: 'film',
    description: 'Extreme warmth, high contrast, intense energy, desert epic',
    vector: {
      warmth: 0.8,
      contrast: 0.8,
      arousal: 0.9,
      saturation: 0.6,
      dominance: 0.6,
      atmosphere: 0.3,
    },
    tags: ['mad max', 'fury road', 'desert', 'apocalyptic', 'action'],
    source: 'industry-derived',
  },
  {
    name: 'her_film',
    category: 'film',
    description: 'Warm pastels, soft focus, gentle intimacy, quiet pleasure',
    vector: {
      warmth: 0.6,
      intimacy: 0.6,
      pleasure: 0.6,
      saturation: 0.3,
      contrast: -0.4,
      arousal: -0.4,
    },
    tags: ['her', 'spike jonze', 'soft', 'romantic', 'gentle', 'pastel'],
    source: 'industry-derived',
  },

  // ── Genre ─────────────────────────────────────────────────────────
  {
    name: 'product_clean',
    category: 'genre',
    description: 'White/neutral background, even lighting, no atmosphere, crisp',
    vector: {
      contrast: -0.3,
      complexity: -0.7,
      atmosphere: -0.8,
      surface_detail: -0.3,
      saturation: 0.1,
      groundedness: -0.3,
    },
    tags: ['product', 'clean', 'e-commerce', 'catalog', 'white background'],
    source: 'industry-derived',
  },
  {
    name: 'product_luxury',
    category: 'genre',
    description: 'Dark background, dramatic rim light, rich materials, elegant',
    vector: {
      contrast: 0.6,
      key_direction: 0.5,
      warmth: 0.2,
      pleasure: 0.6,
      surface_detail: -0.2,
      atmosphere: 0.1,
      complexity: -0.4,
    },
    tags: ['luxury', 'premium', 'jewelry', 'watch', 'perfume', 'elegant'],
    source: 'industry-derived',
  },
  {
    name: 'landscape_epic',
    category: 'genre',
    description: 'Wide shot, deep layers, atmospheric depth, golden light, grandeur',
    vector: {
      shot_scale: 0.8,
      dominance: 0.7,
      depth_spread: 0.7,
      atmosphere: 0.4,
      warmth: 0.3,
      pleasure: 0.5,
      groundedness: 0.6,
    },
    tags: ['landscape', 'epic', 'vista', 'panorama', 'scenic', 'nature'],
    source: 'industry-derived',
  },
  {
    name: 'portrait_editorial',
    category: 'genre',
    description: 'Close framing, shallow DOF, side light, editorial beauty',
    vector: {
      intimacy: 0.6,
      shot_scale: -0.5,
      contrast: 0.3,
      key_direction: 0.3,
      pleasure: 0.4,
      surface_detail: -0.2,
    },
    tags: ['portrait', 'editorial', 'headshot', 'fashion', 'beauty'],
    source: 'industry-derived',
  },
  {
    name: 'still_life_dutch',
    category: 'genre',
    description: 'Dark background, warm side light, rich textures, contemplative',
    vector: {
      warmth: 0.5,
      contrast: 0.5,
      surface_detail: 0.6,
      complexity: 0.3,
      arousal: -0.3,
      intimacy: 0.3,
      key_direction: 0.3,
    },
    tags: ['still life', 'dutch', 'vanitas', 'table top', 'food photography'],
    source: 'industry-derived',
  },
  {
    name: 'architectural_modern',
    category: 'genre',
    description: 'Clean lines, neutral light, minimal, geometric precision',
    vector: {
      complexity: -0.5,
      contrast: 0.2,
      warmth: -0.1,
      saturation: -0.2,
      surface_detail: -0.5,
      groundedness: 0.6,
      shot_scale: 0.3,
    },
    tags: ['architecture', 'modern', 'minimal', 'geometric', 'interior', 'building'],
    source: 'industry-derived',
  },
  {
    name: 'macro_nature',
    category: 'genre',
    description: 'Extreme close-up, shallow DOF, rich detail, organic beauty',
    vector: {
      shot_scale: -0.8,
      intimacy: 0.7,
      surface_detail: 0.7,
      pleasure: 0.5,
      saturation: 0.4,
      depth_spread: -0.3,
    },
    tags: ['macro', 'close-up', 'nature', 'insect', 'flower', 'mushroom', 'detail'],
    source: 'industry-derived',
  },

  // ── Hidden / Easter Eggs ───────────────────────────────────────────
  {
    name: 'sega',
    category: 'hidden',
    description: 'SEEEGAAAA! Vivid electric 90s energy — saturation cranked, high arousal.',
    vector: {
      saturation: 0.8,
      arousal: 0.6,
      contrast: 0.5,
      warmth: -0.1,
      pleasure: 0.5,
    },
    tags: ['sega', 'sonic', 'genesis', 'mega drive', 'retro', '90s'],
    source: 'easter-egg',
    easterEgg: {
      event: 'sega',
      art: [
        '  ╔═══════════════════════════════════╗',
        '  ║  ░██████╗███████╗░██████╗░█████╗  ║',
        '  ║  ██╔════╝██╔════╝██╔════╝██╔══██╗ ║',
        '  ║  ╚█████╗░█████╗░░██║░░██╗███████║ ║',
        '  ║  ░╚═══██╗██╔══╝░░██║░░╚██╔══██║║ ║',
        '  ║  ██████╔╝███████╗╚██████╗██║░░██║ ║',
        '  ║  ╚═════╝░╚══════╝░╚═════╝╚═╝░░╚═╝ ║',
        '  ╚═══════════════════════════════════╝',
      ].join('\n'),
      tradition:
        'SEGA: Semantic Artistic Guidance — a perceptual computing framework ' +
        'that maps human aesthetic intent to physically-based rendering parameters ' +
        'across 15 dimensions. The fact that it shares its name with the legendary ' +
        'game company? Pure serendipity. No hedgehogs were harmed in the making of ' +
        'this renderer.',
    },
  },
  {
    name: 'moo',
    category: 'hidden',
    description: 'Have you mooed today?',
    vector: {
      pleasure: 0.6,
      warmth: 0.3,
      arousal: -0.2,
      groundedness: 0.5,
    },
    tags: ['moo', 'cow', 'easter egg'],
    source: 'easter-egg',
    easterEgg: {
      event: 'moo',
      art: [
        '         (__)',
        '         (oo)',
        '   /------\\/',
        '  / |    ||',
        ' *  /\\---/\\',
        '    ~~   ~~',
      ].join('\n'),
      tradition:
        'The classic developer easter egg. apt-get moo, pip install moo, ' +
        'npm moo — every good tool has one. Now Octane SEGA does too.',
    },
  },
  {
    name: 'dino',
    category: 'hidden',
    description: 'No internet required. Prehistoric desert mood.',
    vector: {
      warmth: 0.8,
      contrast: 0.7,
      complexity: -0.5,
      groundedness: 0.8,
      atmosphere: 0.3,
      saturation: -0.2,
    },
    tags: ['dino', 't-rex', 'dinosaur', 'chrome', 'offline', 'runner'],
    source: 'easter-egg',
    easterEgg: {
      event: 'dino',
      art: [
        '            __',
        '           / _)',
        '    _.----._/ /',
        '   /         /',
        ' __/ (  | (  |',
        "/__.-'|_|--|_|",
      ].join('\n'),
      tradition:
        "Inspired by Chrome's offline T-Rex runner — the hidden game that appears " +
        'when you lose your internet connection. Press spacebar to jump! ' +
        'This preset channels that barren, sun-scorched desert energy.',
    },
  },
  {
    name: 't-rex',
    category: 'hidden',
    description: 'Alias for dino preset.',
    vector: {
      warmth: 0.8,
      contrast: 0.7,
      complexity: -0.5,
      groundedness: 0.8,
      atmosphere: 0.3,
      saturation: -0.2,
    },
    tags: ['t-rex', 'dino', 'dinosaur', 'chrome', 'offline'],
    source: 'easter-egg',
    easterEgg: {
      event: 'dino',
      art: [
        '            __',
        '           / _)',
        '    _.----._/ /',
        '   /         /',
        ' __/ (  | (  |',
        "/__.-'|_|--|_|",
      ].join('\n'),
      tradition:
        "Inspired by Chrome's offline T-Rex runner — the hidden game that appears " +
        'when you lose your internet connection. Press spacebar to jump!',
    },
  },
  {
    name: 'bob_ross',
    category: 'hidden',
    description: 'Happy little trees. No mistakes, just happy accidents.',
    vector: {
      warmth: 0.5,
      contrast: -0.2,
      arousal: -0.4,
      pleasure: 0.7,
      groundedness: 0.6,
      atmosphere: 0.2,
    },
    tags: ['bob ross', 'happy', 'trees', 'accidents', 'painting'],
    source: 'easter-egg',
  },
  {
    name: 'vaporwave',
    category: 'hidden',
    description: 'A E S T H E T I C',
    vector: {
      saturation: 0.7,
      warmth: -0.3,
      contrast: 0.3,
      atmosphere: 0.5,
      complexity: -0.3,
      pleasure: 0.4,
    },
    tags: ['vaporwave', 'aesthetic', 'retro', 'synthwave', '80s', 'neon'],
    source: 'easter-egg',
  },
  {
    name: 'liminal',
    category: 'hidden',
    description: 'The backrooms called. Something feels... off.',
    vector: {
      arousal: -0.6,
      pleasure: -0.4,
      atmosphere: 0.6,
      complexity: -0.6,
      warmth: 0.1,
      intimacy: -0.3,
      groundedness: 0.4,
    },
    tags: ['liminal', 'backrooms', 'uncanny', 'eerie', 'empty'],
    source: 'easter-egg',
  },
];

// ── Lookup Helpers ──────────────────────────────────────────────────

/** Get a preset by exact name. */
export function getPreset(name: string): SemanticPreset | undefined {
  return PRESETS.find(p => p.name === name.toLowerCase());
}

/** Find presets matching a tag (case-insensitive substring). */
export function findPresetsByTag(tag: string): SemanticPreset[] {
  const lower = tag.toLowerCase();
  return PRESETS.filter(p => p.tags.some(t => t.toLowerCase().includes(lower)));
}

/** List all presets, optionally filtered by category. Hidden presets excluded by default. */
export function listPresets(category?: PresetCategory, includeHidden = false): SemanticPreset[] {
  const base = includeHidden ? PRESETS : PRESETS.filter(p => p.category !== 'hidden');
  if (!category) return [...base];
  return base.filter(p => p.category === category);
}

/** List just preset names, optionally filtered by category. Hidden presets excluded by default. */
export function listPresetNames(category?: PresetCategory, includeHidden = false): string[] {
  return listPresets(category, includeHidden).map(p => p.name);
}
