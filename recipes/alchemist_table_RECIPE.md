# The Alchemist's Table — Scene Recipe

## Concept

A cluttered worktable of an obsessed alchemist, lit by the glow of a molten substance in a crucible. Dark, warm, rich — like a Rembrandt still life with magical elements. Chiaroscuro lighting from a diegetic source.

## Mood

Mysterious luxury. Forbidden knowledge. Dangerous beauty.

## Palette

- **Warm gold/amber** — molten glow, gold coins, candlelight temperature
- **Dark brown** — wood table, leather
- **Deep green** — glass flask transmission
- **Gunmetal/iron** — crucible
- **Clear/white** — crystal prism (high IOR for dispersion)
- **Grey stone** — mortar

## Objects (8 total)

### 1. Table Surface

- **Primitive**: Box (val 1)
- **Scale**: {3, 0.1, 2}
- **Translation**: {0, 0, 0} (ground plane)
- **Material**: Glossy — dark walnut wood texture on diffuse, specular 0.3, roughness 0.15
- **Texture**: `textures/dark_walnut_wood.jpg`

### 2. Crucible (Iron Bowl)

- **Primitive**: Sphere (val 20)
- **Scale**: {0.35, 0.35, 0.35}
- **Translation**: {0.3, 0.05, -0.2} (center-right on table, sunk slightly)
- **Material**: Glossy — diffuse (0.15, 0.12, 0.1), IOR 100, roughness 0.3

### 3. Molten Glow Sphere (KEY LIGHT SOURCE)

- **Primitive**: Sphere (val 20)
- **Scale**: {0.15, 0.15, 0.15}
- **Translation**: {0.3, 0.2, -0.2} (nestled above crucible rim)
- **Material**: Diffuse with blackbody emission
- **Emission**: NT_EMIS_BLACKBODY, temperature 1800K, power 300, efficiency 1.0

### 4. Glass Flask

- **Primitive**: Capsule (val 2)
- **Scale**: {0.12, 0.4, 0.12}
- **Translation**: {-0.5, 0.2, 0.1} (left of center, tall)
- **Material**: Specular — transmission (0.2, 0.8, 0.3), IOR 1.5, roughness 0.02

### 5. Crystal Prism

- **Primitive**: Octahedron (val 14)
- **Scale**: {0.15, 0.2, 0.15}
- **Translation**: {-0.05, 0.1, 0.15} (between crucible and flask)
- **Material**: Specular — transmission (1, 1, 1), IOR 2.0, roughness 0.0

### 6. Gold Coin 1

- **Primitive**: Box (val 1)
- **Scale**: {0.12, 0.02, 0.12}
- **Translation**: {0.55, 0.06, -0.1} (near crucible)
- **Material**: Glossy — diffuse (1, 0.84, 0), IOR 100, roughness 0.1

### 7. Gold Coin 2

- **Primitive**: Box (val 1)
- **Scale**: {0.1, 0.02, 0.1}
- **Translation**: {0.45, 0.06, 0.05} (near crucible, slightly offset)
- **Rotation**: {0, 15, 0}
- **Material**: Same gold glossy as Coin 1

### 8. Mortar (Stone Bowl)

- **Primitive**: Torus (val 22)
- **Scale**: {0.18, 0.08, 0.18}
- **Translation**: {-0.7, 0.08, -0.3} (far left, behind flask)
- **Material**: Diffuse — volcanic stone texture
- **Texture**: `textures/volcanic_stone.jpg`

## Lighting

### Key Light: Molten Glow (Object 3)

- NT_EMIS_BLACKBODY on the molten sphere's material
- Temperature: 1800K (deep amber/orange)
- Power: 300
- Efficiency: 1.0 (NOT the default 0.025)
- This IS the scene. All warm light comes from here.

### Fill: Daylight Environment

- Power: 0.03 (nearly black — just enough to keep shadows from crushing)
- Hour: ~18 (twilight, so ambient fill is cool blue)

### Optional Rim: Sphere Light

- Position behind and above table
- Cool white (7000K), power 30
- Subtle edge separation on silhouettes

## Camera

- **Position**: {2.5, 1.8, 3.5} — elevated, offset right
- **Target**: {0, 0.15, 0} — just above table surface, near crucible
- **DOF**: OFF (aperture = 0)
- Rule of thirds: crucible/glow at lower-right third intersection

## Kernel

- Path Tracing, 2000 samples
- AI Light enabled for better noise convergence on small emitters

## Build Order (crash-safe)

1. Create RT + PT kernel + daylight env (power 0.03)
2. Connect kernel + env to RT
3. Create geo group (DO NOT connect to RT yet)
4. Create each object ONE AT A TIME:
   a. create_node → set primitive type → set transform → set scale
   b. Create/connect material
   c. Connect to geo group
5. AFTER all objects connected to geo group → connect geo group to RT pin 3
6. start_render → set_camera → save_render

## Textures (pre-generated)

- `textures/dark_walnut_wood.jpg` — PBR albedo, dark walnut grain
- `textures/old_parchment.jpg` — aged yellowed paper (reserve for future)
- `textures/volcanic_stone.jpg` — rough grey stone with mineral flecks

## Anti-CG Techniques (from OCTANE_CREATIVE.md)

- Diegetic lighting (light source is a scene object)
- Warm/cool color temperature contrast
- Object variety (different shapes, materials, sizes)
- Slight randomness in coin placement/rotation
- Reflective table catches warm light pool
