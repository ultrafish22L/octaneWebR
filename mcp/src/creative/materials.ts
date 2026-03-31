/**
 * Material knowledge — suggest_material tool.
 *
 * Returns Octane Universal Material attribute values for 30+ surface types.
 * All values are for NT_MAT_UNIVERSAL (type 130).
 */

export interface MaterialRecipe {
  surfaceType: string;
  albedo: { r: number; g: number; b: number }; // linear RGB 0-1
  roughness: number; // 0-1
  metallic: number; // 0-1
  specular: number; // 0-1
  ior: number; // index of refraction
  sheenAmount?: number; // for fabrics
  coatingAmount?: number; // for clearcoat
  coatingRoughness?: number;
  transmissionType?: number; // 0=none, 1=diffuse, 2=specular
  mediumDensity?: number; // for SSS/translucent
  emissionPower?: number; // if self-emitting
  emissionTemp?: number; // Kelvin
  notes: string;
}

const MATERIALS: Record<string, MaterialRecipe> = {
  // ── Organic ────────────────────────────────────────────────────
  mushroom_cap: {
    surfaceType: 'mushroom_cap',
    albedo: { r: 0.15, g: 0.35, b: 0.45 }, // teal-blue
    roughness: 0.6,
    metallic: 0,
    specular: 0.4,
    ior: 1.45,
    notes: 'Smooth organic cap with slight spec. Teal/blue default — tint via texture power.',
  },
  mushroom_stem: {
    surfaceType: 'mushroom_stem',
    albedo: { r: 0.7, g: 0.65, b: 0.55 }, // cream
    roughness: 0.7,
    metallic: 0,
    specular: 0.3,
    ior: 1.4,
    notes: 'Fibrous stem, higher roughness than cap.',
  },
  moss: {
    surfaceType: 'moss',
    albedo: { r: 0.12, g: 0.25, b: 0.08 }, // dark green
    roughness: 0.95,
    metallic: 0,
    specular: 0.15,
    ior: 1.35,
    notes: 'Very rough micro-geometry. Almost no specular.',
  },
  bark: {
    surfaceType: 'bark',
    albedo: { r: 0.15, g: 0.1, b: 0.06 }, // dark brown
    roughness: 0.85,
    metallic: 0,
    specular: 0.2,
    ior: 1.4,
    notes: 'Rough, dark. Use bump/displacement for fissures.',
  },
  leaf_fresh: {
    surfaceType: 'leaf_fresh',
    albedo: { r: 0.1, g: 0.35, b: 0.05 },
    roughness: 0.4,
    metallic: 0,
    specular: 0.5,
    ior: 1.45,
    coatingAmount: 0.3,
    coatingRoughness: 0.1,
    notes: 'Waxy coating on fresh leaves gives specular highlight.',
  },
  flower_petal: {
    surfaceType: 'flower_petal',
    albedo: { r: 0.5, g: 0.1, b: 0.6 }, // purple
    roughness: 0.3,
    metallic: 0,
    specular: 0.5,
    ior: 1.45,
    transmissionType: 1, // diffuse transmission for petal translucency
    notes: 'Semi-translucent, smooth. Color varies by species.',
  },
  skin_human: {
    surfaceType: 'skin_human',
    albedo: { r: 0.7, g: 0.5, b: 0.4 },
    roughness: 0.45,
    metallic: 0,
    specular: 0.4,
    ior: 1.4,
    transmissionType: 1,
    mediumDensity: 5,
    notes: 'SSS essential for skin. Medium density controls scatter depth.',
  },

  // ── Stone / Mineral ────────────────────────────────────────────
  marble: {
    surfaceType: 'marble',
    albedo: { r: 0.9, g: 0.88, b: 0.85 },
    roughness: 0.25,
    metallic: 0,
    specular: 0.6,
    ior: 1.56,
    notes: 'Polished marble. Slightly warm tint. Lower roughness for high polish.',
  },
  marble_dark: {
    surfaceType: 'marble_dark',
    albedo: { r: 0.08, g: 0.07, b: 0.06 },
    roughness: 0.15,
    metallic: 0,
    specular: 0.7,
    ior: 1.56,
    notes: 'Dark polished marble (nero marquina). Very reflective.',
  },
  concrete: {
    surfaceType: 'concrete',
    albedo: { r: 0.4, g: 0.38, b: 0.35 },
    roughness: 0.9,
    metallic: 0,
    specular: 0.15,
    ior: 1.5,
    notes: 'Raw concrete. Very rough, low specular.',
  },
  ceramic: {
    surfaceType: 'ceramic',
    albedo: { r: 0.85, g: 0.82, b: 0.78 },
    roughness: 0.1,
    metallic: 0,
    specular: 0.8,
    ior: 1.65,
    notes: 'Glazed ceramic. Very smooth and reflective.',
  },
  plaster: {
    surfaceType: 'plaster',
    albedo: { r: 0.8, g: 0.78, b: 0.75 },
    roughness: 0.7,
    metallic: 0,
    specular: 0.2,
    ior: 1.5,
    notes: 'Matte plaster/stucco. Warm off-white.',
  },
  stone_rough: {
    surfaceType: 'stone_rough',
    albedo: { r: 0.3, g: 0.28, b: 0.25 },
    roughness: 0.8,
    metallic: 0,
    specular: 0.3,
    ior: 1.5,
    notes: 'General rough stone. Darken albedo for wet look.',
  },
  stone_mossy: {
    surfaceType: 'stone_mossy',
    albedo: { r: 0.18, g: 0.25, b: 0.12 },
    roughness: 0.85,
    metallic: 0,
    specular: 0.2,
    ior: 1.45,
    notes: 'Blend between stone and moss. Use mix texture for variation.',
  },
  crystal: {
    surfaceType: 'crystal',
    albedo: { r: 0.95, g: 0.95, b: 1.0 },
    roughness: 0.02,
    metallic: 0,
    specular: 1.0,
    ior: 1.8,
    transmissionType: 2, // specular transmission
    notes: 'Highly refractive, clear. IOR 1.8 for quartz.',
  },
  obsidian: {
    surfaceType: 'obsidian',
    albedo: { r: 0.02, g: 0.02, b: 0.03 },
    roughness: 0.05,
    metallic: 0,
    specular: 0.8,
    ior: 1.5,
    notes: 'Nearly black, mirror-like. Volcanic glass.',
  },

  // ── Metal ──────────────────────────────────────────────────────
  gold: {
    surfaceType: 'gold',
    albedo: { r: 1.0, g: 0.77, b: 0.34 },
    roughness: 0.15,
    metallic: 1.0,
    specular: 1.0,
    ior: 1.5,
    notes: 'Full metallic. Edge tint slightly orange.',
  },
  silver: {
    surfaceType: 'silver',
    albedo: { r: 0.95, g: 0.95, b: 0.95 },
    roughness: 0.1,
    metallic: 1.0,
    specular: 1.0,
    ior: 1.5,
    notes: 'Full metallic, neutral.',
  },
  copper: {
    surfaceType: 'copper',
    albedo: { r: 0.95, g: 0.64, b: 0.54 },
    roughness: 0.2,
    metallic: 1.0,
    specular: 1.0,
    ior: 1.5,
    notes: 'Warm metallic. Increase roughness for aged/patina.',
  },
  iron_rusted: {
    surfaceType: 'iron_rusted',
    albedo: { r: 0.35, g: 0.15, b: 0.05 },
    roughness: 0.9,
    metallic: 0.3,
    specular: 0.3,
    ior: 1.5,
    notes: 'Rust is mostly non-metallic. Low specular, very rough.',
  },

  // ── Fabric / Soft ─────────────────────────────────────────────
  velvet: {
    surfaceType: 'velvet',
    albedo: { r: 0.3, g: 0.05, b: 0.1 },
    roughness: 0.8,
    metallic: 0,
    specular: 0.3,
    ior: 1.35,
    sheenAmount: 0.8,
    notes: 'Sheen essential for velvet look. Edge brightening.',
  },
  silk: {
    surfaceType: 'silk',
    albedo: { r: 0.6, g: 0.55, b: 0.5 },
    roughness: 0.3,
    metallic: 0,
    specular: 0.5,
    ior: 1.4,
    sheenAmount: 0.5,
    notes: 'Smoother than velvet, moderate sheen.',
  },
  cotton: {
    surfaceType: 'cotton',
    albedo: { r: 0.7, g: 0.7, b: 0.68 },
    roughness: 0.85,
    metallic: 0,
    specular: 0.15,
    ior: 1.35,
    notes: 'Very diffuse, almost no specular.',
  },

  // ── Liquid / Transparent ──────────────────────────────────────
  water: {
    surfaceType: 'water',
    albedo: { r: 0.95, g: 0.97, b: 1.0 },
    roughness: 0.0,
    metallic: 0,
    specular: 1.0,
    ior: 1.33,
    transmissionType: 2,
    notes: 'IOR 1.33. Roughness 0 for calm, 0.1+ for ripples.',
  },
  glass: {
    surfaceType: 'glass',
    albedo: { r: 0.98, g: 0.98, b: 0.98 },
    roughness: 0.0,
    metallic: 0,
    specular: 1.0,
    ior: 1.52,
    transmissionType: 2,
    notes: 'IOR 1.52 for standard glass. Add green/blue tint to albedo for colored glass.',
  },
  ice: {
    surfaceType: 'ice',
    albedo: { r: 0.85, g: 0.92, b: 0.98 },
    roughness: 0.05,
    metallic: 0,
    specular: 0.9,
    ior: 1.31,
    transmissionType: 2,
    mediumDensity: 2,
    notes: 'Slightly blue, slight SSS for depth.',
  },
  wax: {
    surfaceType: 'wax',
    albedo: { r: 0.8, g: 0.7, b: 0.5 },
    roughness: 0.4,
    metallic: 0,
    specular: 0.5,
    ior: 1.45,
    transmissionType: 1,
    mediumDensity: 8,
    notes: 'Strong SSS. Warm translucency.',
  },

  // ── Emissive ──────────────────────────────────────────────────
  glow_warm: {
    surfaceType: 'glow_warm',
    albedo: { r: 0, g: 0, b: 0 },
    roughness: 1.0,
    metallic: 0,
    specular: 0,
    ior: 1.0,
    emissionPower: 200,
    emissionTemp: 2500,
    notes: 'Pure emitter — black albedo, emission only. Warm candle-like glow.',
  },
  glow_cool: {
    surfaceType: 'glow_cool',
    albedo: { r: 0, g: 0, b: 0 },
    roughness: 1.0,
    metallic: 0,
    specular: 0,
    ior: 1.0,
    emissionPower: 200,
    emissionTemp: 7000,
    notes: 'Cool blue-white emission.',
  },
  bioluminescent: {
    surfaceType: 'bioluminescent',
    albedo: { r: 0.05, g: 0.15, b: 0.1 },
    roughness: 0.6,
    metallic: 0,
    specular: 0.3,
    ior: 1.4,
    emissionPower: 5,
    emissionTemp: 3000,
    notes:
      'Subtle self-glow with visible surface. Low emission power — supplements, not replaces lighting.',
  },

  // ── Ground / Environment ──────────────────────────────────────
  dirt: {
    surfaceType: 'dirt',
    albedo: { r: 0.2, g: 0.15, b: 0.1 },
    roughness: 0.95,
    metallic: 0,
    specular: 0.1,
    ior: 1.35,
    notes: 'Very rough, very low specular. Dark.',
  },
  sand: {
    surfaceType: 'sand',
    albedo: { r: 0.6, g: 0.55, b: 0.4 },
    roughness: 0.9,
    metallic: 0,
    specular: 0.2,
    ior: 1.4,
    notes: 'Lighter than dirt, slight warmth.',
  },
  snow: {
    surfaceType: 'snow',
    albedo: { r: 0.9, g: 0.92, b: 0.95 },
    roughness: 0.7,
    metallic: 0,
    specular: 0.4,
    ior: 1.31,
    transmissionType: 1,
    mediumDensity: 3,
    notes: 'Very bright, slight SSS. Not pure white — has slight blue tint.',
  },
};

/**
 * Get a material recipe by surface type.
 * Returns the recipe or null if unknown.
 */
export function suggestMaterial(surfaceType: string): MaterialRecipe | null {
  return MATERIALS[surfaceType.toLowerCase()] || null;
}

/**
 * List all available surface types.
 */
export function listMaterialTypes(): string[] {
  return Object.keys(MATERIALS);
}
