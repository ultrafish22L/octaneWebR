# SEGA User Guide — Research, Gemini Analysis, and How It Works

## Part 1: Research Foundations

### 1.1 What Is SEGA?

SEGA (Semantic Guidance) originates from Brack et al. (2023) — a technique for steering diffusion models by manipulating the latent space along named semantic directions. The key properties:

- **Monotonic**: Increasing a guidance value monotonically increases that quality
- **Isolated**: Changing one concept doesn't disturb others
- **Composable**: Multiple concepts combine without conflict
- **Reversible**: Negative guidance removes a concept

We adapt these principles from pixel generation to DCC parameter control. Instead of steering a diffusion process, we steer Octane's lighting, materials, and camera through a semantic vector.

### 1.2 Academic Sources

| Source                                                                         | What It Provides                                                                                    | How We Use It                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Mehrabian & Russell (1974)** — PAD model                                     | Pleasure, Arousal, Dominance as core emotional dimensions                                           | 3 foundational dimensions for emotional intent             |
| **Berlyne (1971)** — Aesthetics and Psychobiology                              | Inverted-U relationship between complexity/arousal and aesthetic pleasure                           | Extreme value warnings                                     |
| **CineTechBench (Wu et al. 2025)** — arXiv:2505.15145                          | 7 cinematographic dimensions with structured sub-categories, built by professional cinematographers | Shot scale, angle, lighting style, color scheme vocabulary |
| **Itten (1961)** — The Art of Color                                            | Warm/cool, complementary tension, saturation as compositional tools                                 | Color-related dimensions                                   |
| **ASC Manual** — American Society of Cinematographers                          | Key:fill ratios, color temperature standards, shadow quality metrics                                | Parameter mapping ranges for lighting dimensions           |
| **Brack et al. (2023)** — SEGA paper                                           | Monotonic, isolated, composable semantic guidance                                                   | Core architectural principle                               |
| **DARCI (BYU)** — Digital Artist Communicating Intention                       | AI self-evaluation against semantic intent (perceptual grounding)                                   | Critique loop: measure render against intent vector        |
| **3D Scene Graphs (Stanford)** — object-level semantics + relationship mapping | Structured scene representation with typed relationships                                            | Relationship edges between objects                         |

### 1.3 Industry Standards Used

- **Rembrandt, butterfly, split, loop lighting** — named lighting setups from portrait photography and film (ASC standard terminology)
- **Key:fill ratios** — measured in stops or numeric ratios (ASC Manual: 2:1 = natural, 4:1 = moderate drama, 8:1+ = noir)
- **Color temperature** — Kelvin scale (1800K candle → 5500K daylight → 10000K+ overcast sky)
- **Rule of thirds, golden ratio, diagonal** — composition grids from visual art tradition
- **Shot scale taxonomy** — extreme close-up through extreme wide shot (CineTechBench, industry standard)

---

## Part 2: How a Human Uses the System

### 2.1 Starting a Scene

**What you say:**

> "I want to build a product shot of a gold sphere. Dramatic lighting, like Caravaggio."

**What happens inside:**

1. NL parser identifies: genre = `product_shot`, mood = `dramatic`, preset = `caravaggio`
2. System loads `caravaggio` preset: `{ warmth: 0.5, contrast: 0.8, key_direction: 0.4, intimacy: 0.3, atmosphere: 0.2 }`
3. System loads `product_shot` genre defaults: `{ shot_scale: -0.2, camera_angle: 0.0, groundedness: 0.6 }`
4. Merges them (preset wins on conflicts): active vector has ~8 dimensions set
5. Parameter mapping resolves: key temp 3000K, fill ratio 6:1, environment power 0.1, camera elevation 5 deg, etc.
6. System shows you the resolved intent + parameters before building anything

**What you see:**

```
Intent: Caravaggio product shot
Active dimensions: warmth=0.5, contrast=0.8, key_direction=0.4,
                   intimacy=0.3, atmosphere=0.2, groundedness=0.6
                   shot_scale=-0.2, camera_angle=0.0

Resolved parameters:
  Key light: 3000K, power 180, 40deg from camera axis
  Fill: power 30 (ratio 6:1)
  Environment: 0.1 power
  Camera: 12 units back, 5deg elevation, 72deg FOV

Proceed with build?
```

### 2.2 Adjusting During Build

**What you say:**

> "Warmer. And less contrast, it's too harsh."

**What happens inside:**

1. NL parser returns: `{ warmth: +0.15, contrast: -0.25 }` (relative deltas)
2. System applies deltas: warmth 0.5 → 0.65, contrast 0.8 → 0.55
3. Parameter mapping re-resolves: key temp shifts from 3000K → 2900K, fill ratio drops from 6:1 → 4:1
4. System applies only the changed parameters to the scene (delta application, not full rebuild)

**What you see:**

```
Adjusted: warmth 0.5→0.65, contrast 0.8→0.55
Changed: key_temp 3000K→2900K, fill_ratio 6:1→4:1
[Re-render in progress...]
```

Other interactions (presets, critique, per-object overrides, Berlyne warnings, undo, saving presets) follow the same pattern: user speaks naturally → NL parser extracts deltas → system resolves parameters → scene updates. See `SEGA_SYSTEM_DESIGN.md` for technical details on each feature.
