/**
 * Lighting knowledge — suggest_lighting tool.
 *
 * Computes light positions, colors, and power from mood + scene bounds.
 * Based on classic 3-point lighting patterns adapted for Octane.
 */

import type { Vec3 } from '../ArtDirectionState';

export interface LightRecipe {
  id: string;
  type: 'key' | 'fill' | 'rim' | 'accent' | 'practical';
  position: Vec3;
  temperature: number; // Kelvin
  power: number;
  notes: string;
}

export interface LightingRecipe {
  mood: string;
  lights: LightRecipe[];
  ratios: string; // e.g. "key:fill:rim = 4:1:2"
  environmentPower: number;
  notes: string;
}

interface Bounds {
  center: Vec3;
  width: number; // X extent
  height: number; // Y extent
  depth: number; // Z extent
}

function boundsFromMinMax(min: Vec3, max: Vec3): Bounds {
  return {
    center: {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2,
    },
    width: Math.max(max.x - min.x, 1),
    height: Math.max(max.y - min.y, 1),
    depth: Math.max(max.z - min.z, 1),
  };
}

/**
 * Compute a lighting recipe from mood and scene bounds.
 *
 * Moods: ethereal, dramatic, natural, studio, noir, golden_hour, moonlit
 */
export function suggestLighting(
  mood: string,
  subjectBounds: { min: Vec3; max: Vec3 },
  cameraPosition?: Vec3
): LightingRecipe {
  const b = boundsFromMinMax(subjectBounds.min, subjectBounds.max);
  const r = Math.max(b.width, b.depth) * 1.5; // light radius from subject

  // Base positions relative to subject center
  const keyPos = (azimuth: number, elevation: number): Vec3 => ({
    x: b.center.x + r * Math.cos((elevation * Math.PI) / 180) * Math.sin((azimuth * Math.PI) / 180),
    y: b.center.y + b.height * 0.5 + r * Math.sin((elevation * Math.PI) / 180),
    z: b.center.z + r * Math.cos((elevation * Math.PI) / 180) * Math.cos((azimuth * Math.PI) / 180),
  });

  switch (mood.toLowerCase()) {
    case 'ethereal':
      return {
        mood: 'ethereal',
        lights: [
          {
            id: 'key_backlight',
            type: 'key',
            position: keyPos(180, 30),
            temperature: 3500,
            power: 20,
            notes: 'Warm backlight through scene — golden hour feel',
          },
          {
            id: 'fill_ambient',
            type: 'fill',
            position: keyPos(-30, 15),
            temperature: 7000,
            power: 5,
            notes: 'Cool fill to contrast warm key',
          },
          {
            id: 'rim_top',
            type: 'rim',
            position: keyPos(0, 70),
            temperature: 4500,
            power: 8,
            notes: 'Top rim for separation',
          },
          {
            id: 'practical_glow',
            type: 'practical',
            position: b.center,
            temperature: 2500,
            power: 3,
            notes: 'Warm practical light inside objects (mushroom caps)',
          },
        ],
        ratios: 'key:fill:rim = 4:1:1.6',
        environmentPower: 0.3,
        notes:
          'Ethereal: warm backlight dominant, cool fill, low env to let practicals glow. Keep scene dark — light comes from objects, not the sky.',
      };

    case 'dramatic':
      return {
        mood: 'dramatic',
        lights: [
          {
            id: 'key',
            type: 'key',
            position: keyPos(45, 45),
            temperature: 4000,
            power: 30,
            notes: 'Hard key at 45° — Rembrandt triangle',
          },
          {
            id: 'fill',
            type: 'fill',
            position: keyPos(-60, 10),
            temperature: 6000,
            power: 5,
            notes: 'Minimal fill — let shadows go deep',
          },
          {
            id: 'rim',
            type: 'rim',
            position: keyPos(-135, 20),
            temperature: 5000,
            power: 15,
            notes: 'Strong rim for edge definition',
          },
        ],
        ratios: 'key:fill:rim = 6:1:3',
        environmentPower: 0.15,
        notes:
          'Dramatic: high key:fill ratio creates deep shadows. Single dominant light source. Env very low.',
      };

    case 'natural':
      return {
        mood: 'natural',
        lights: [
          {
            id: 'key_sun',
            type: 'key',
            position: keyPos(60, 50),
            temperature: 5500,
            power: 15,
            notes: 'Simulated sun at 50° elevation',
          },
          {
            id: 'fill_sky',
            type: 'fill',
            position: keyPos(-90, 60),
            temperature: 8000,
            power: 8,
            notes: 'Blue sky fill from opposite side',
          },
        ],
        ratios: 'key:fill = 2:1',
        environmentPower: 0.6,
        notes:
          'Natural: env does most of the work. Added lights just supplement. Key temp matches afternoon sun.',
      };

    case 'golden_hour':
      return {
        mood: 'golden_hour',
        lights: [
          {
            id: 'key_sun',
            type: 'key',
            position: keyPos(160, 10),
            temperature: 2800,
            power: 25,
            notes: 'Very warm, very low angle — long shadows',
          },
          {
            id: 'fill',
            type: 'fill',
            position: keyPos(-20, 30),
            temperature: 6500,
            power: 4,
            notes: 'Cool fill from sky',
          },
          {
            id: 'rim',
            type: 'rim',
            position: keyPos(180, 5),
            temperature: 2500,
            power: 12,
            notes: 'Warm rim behind — glowing edges',
          },
        ],
        ratios: 'key:fill:rim = 6:1:3',
        environmentPower: 0.25,
        notes:
          'Golden hour: extremely warm key at low angle. Long shadows essential. Env low to let warm light dominate.',
      };

    case 'moonlit':
      return {
        mood: 'moonlit',
        lights: [
          {
            id: 'key_moon',
            type: 'key',
            position: keyPos(120, 60),
            temperature: 8000,
            power: 5,
            notes: 'Cold blue moonlight from high angle',
          },
          {
            id: 'practical_warm',
            type: 'practical',
            position: { x: b.center.x, y: b.center.y + b.height * 0.3, z: b.center.z },
            temperature: 2200,
            power: 3,
            notes: 'Warm practical (candle/lantern/glow)',
          },
        ],
        ratios: 'key:practical = 1.7:1',
        environmentPower: 0.05,
        notes:
          'Moonlit: very dark overall, cool dominant, warm accent from practical sources. Env nearly black.',
      };

    case 'noir':
      return {
        mood: 'noir',
        lights: [
          {
            id: 'key',
            type: 'key',
            position: keyPos(80, 50),
            temperature: 4500,
            power: 25,
            notes: 'Single hard key at steep angle',
          },
          {
            id: 'kick',
            type: 'rim',
            position: keyPos(-120, 10),
            temperature: 5000,
            power: 8,
            notes: 'Subtle kick from behind',
          },
        ],
        ratios: 'key:kick = 3:1',
        environmentPower: 0.02,
        notes: 'Noir: single dominant light, no fill, deep blacks. Env essentially off.',
      };

    case 'studio':
    default:
      return {
        mood: 'studio',
        lights: [
          {
            id: 'key',
            type: 'key',
            position: keyPos(45, 35),
            temperature: 5000,
            power: 15,
            notes: 'Classic key at 45° azimuth, 35° elevation',
          },
          {
            id: 'fill',
            type: 'fill',
            position: keyPos(-45, 15),
            temperature: 5500,
            power: 7,
            notes: 'Fill opposite key, lower angle',
          },
          {
            id: 'rim',
            type: 'rim',
            position: keyPos(-135, 25),
            temperature: 5500,
            power: 10,
            notes: 'Rim for separation from background',
          },
        ],
        ratios: 'key:fill:rim = 2:1:1.4',
        environmentPower: 0.4,
        notes: 'Studio: balanced 3-point, neutral temps, moderate contrast.',
      };
  }
}
