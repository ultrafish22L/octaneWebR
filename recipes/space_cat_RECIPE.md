# Space Cat (Demo Scene)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A cat astronaut floating in deep space, backlit by a distant sun. Earth curves below, massive and blue. The cat's spacesuit catches rim light — a bright corona outlining the figure against the void. Cinematic space photography. Think 2001, think Gravity, think that one shot everyone remembers.

**This is a hero portrait in space.** The cat astronaut is THE subject — everything else exists to frame it. Earth provides scale and color contrast (warm suit against cool blue planet). The sun provides drama (backlight rim). The starfield provides depth. Three supporting elements, one star.

**Backlight is THE look.** Sun behind the cat, toward the camera. Low ambient, strong rim highlights on the spacesuit edges. The figure reads as a silhouette with glowing edges — the classic astronaut-in-space shot. Front fill comes from Earth's reflected light (blue bounce) and the starfield environment at low power.

**Earth is a set piece, not a subject.** A huge sphere (scale 30+) filling part of the background, slightly below. Blue diffuse or textured. It's there for scale and color — don't center it, don't feature it. The cat is the subject. Earth is the backdrop.

**Off-axis camera, face the cat.** Check the OBJ orientation FIRST — don't shoot the cat's back. Place camera to see the face/helmet. The cat should feel like it's looking at us (or past us) while floating weightless.

---

## Directions

_7 renders. Each one a visible change. Brisk, not rushed._

### Prep

Clear the scene. Create render target + path tracing kernel. Connect kernel BEFORE starting render. Set resolution to 1024x576.

### 1. Set the mood

> "Deep space. Near-black void with sparse stars."

Create texture environment with starfield image at low power (~0.5). Create quad light behind and above — the sun, warm white, high power. Connect to RT. Start render. Set hero camera. First frame: dark space with a bright point of light.

### 2. The cat appears

> "Cat astronaut floating in the void."

Create geo group (8 slots). Load cat_astronaut.obj mesh. Position floating in space. Check orientation — render and verify we see the FACE, not the back. Adjust rotation if needed.

### 3. Earth below

> "Blue curve filling the background. Scale."

Sphere mesh at massive scale (30+), positioned below and behind the cat. Blue diffuse material. Earth anchors the composition and provides cool color contrast.

### 4. Dress the cat

> "Textured spacesuit. The hero dresses up."

Apply cat_astronaut_tex.png as diffuse texture on the cat mesh. The suit gets detail and color.

### 5. Dress Earth

> "Blue planet with texture. Real enough."

If earth texture available, apply it. Otherwise blue diffuse is fine — Earth is backdrop, not subject.

### 6. Backlight magic

> "Sun behind the cat. Rim light. That's the shot."

Tune the quad light — position behind the cat relative to camera. High power (20000+), warm white (5500K). The cat's edges glow with rim light against the dark void. Adjust until the silhouette pops.

### 7. Final framing

> "Hero camera. Cat's face, Earth below, sun corona above. Wow."

Refine camera to nail the composition. Cat fills center, Earth curves below, sun glow above/behind. Three layers of depth.

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                          |
| ---------- | ------------------------------ |
| Position   | (-1.5, 2, -9)                  |
| Target     | (0.5, 0, 0)                    |
| Up         | (0, 1, 0) — STANDARD           |
| FOV        | 39.598°                        |
| Resolution | 1024x1024 interactive (square) |
| Beauty     | 1024x1024                      |
| DOF        | Off (aperture=0)               |

**NOTE**: Camera up vector is standard (0,1,0). Cat rotation compensates for +Y face direction. `set_camera()` works normally — no workarounds needed.

### Environment

| Setting | Value                     | Notes                    |
| ------- | ------------------------- | ------------------------ |
| Texture | ORBX/assets/starfield.jpg | Sparse starfield         |
| Power   | 0.3–0.5                   | Very low — space is dark |

### Cat Astronaut

| Setting  | Value                                                                    |
| -------- | ------------------------------------------------------------------------ |
| Mesh     | cat_astronaut.obj                                                        |
| Texture  | cat_astronaut_tex.png                                                    |
| Position | (0, 0, 0) — origin                                                       |
| Rotation | (-1.5708, -0.2, 0) — X=-90° faces cat toward -Z, Y=-0.2 slight 3/4 angle |
| Scale    | (5, 5, 5)                                                                |
| Material | Universal mat + image texture                                            |
| Face     | Points +Y natively                                                       |

### Earth

| Setting  | Value                         |
| -------- | ----------------------------- |
| Mesh     | sphere_hd.obj                 |
| Position | (8, -35, 25)                  |
| Scale    | (30, 30, 30)                  |
| Material | Diffuse + earth_daymap_8k.jpg |

### Lights

| Light     | Position      | Power | Size | Notes                 |
| --------- | ------------- | ----- | ---- | --------------------- |
| Key       | (10, 18, -15) | 15000 | 3    | Upper-right sun flare |
| Fill      | (-2, 12, -5)  | 15000 | 5    | Face illumination     |
| Backlight | (2, -10, 4)   | 50000 | 8    | Rim light behind cat  |

All lights: NT_LIGHT_QUAD, camera-invisible.

### Render

| Setting | Value        |
| ------- | ------------ |
| Samples | 5000         |
| Kernel  | Path tracing |

---

## Handle Map

_Fill as you build. Reference for camera tweaks and material iteration._

| Object     | Mesh    | Placement | Transform | Material | Geo Group Slot |
| ---------- | ------- | --------- | --------- | -------- | -------------- |
| Cat        | 1000199 | 1000245   | 1000247   | 1000290  | Input 1        |
| Earth      | 1000375 | 1000416   | 1000417   | 1000427  | Input 2        |
| Key Light  | 1000526 | —         | 1000530   | —        | Input 3        |
| Fill Light | 1000541 | —         | 1000545   | —        | Input 4        |
| Backlight  | 1000684 | —         | 1000688   | —        | Input 5        |

### Additional Handles

| Node                | Handle  |
| ------------------- | ------- |
| RT                  | 1000003 |
| Camera              | 1000004 |
| Camera pos          | 1000159 |
| Camera target       | 1000162 |
| Camera up           | 1000165 |
| Kernel              | 1000014 |
| Env                 | 1000055 |
| Starfield tex       | 1000099 |
| Geo group           | 1000157 |
| Film resolution     | 1000207 |
| Cat texture         | 1000673 |
| Earth texture       | 1000479 |
| Key light power     | 1000574 |
| Fill light power    | 1000585 |
| Backlight           | 1000684 |
| Backlight transform | 1000688 |
| Backlight power     | 1000705 |

---

## Demo Flow (OTOY Studio Fake + Real MCP Build)

### Act 1 — OTOY Studio walkthrough (narrated, assets pre-baked)

1. Open otoy.studio → Seedream v4.5
2. Type prompt: "cat astronaut floating in space, cinematic lighting, detailed spacesuit"
3. Narrate generation → show space_cat.jpg as "the result"
4. Navigate to Image-to-3D (Hunyuan-3d v3.1 Pro)
5. Narrate conversion → show the 3D viewer if possible
6. "Download OBJ" → asset already in ORBX/assets/

### Act 2 — Octane MCP build (real, DRESS mode)

Follow Directions above. The audience watches a 3D scene assemble in real-time from the "just generated" model.

---

## What Didn't Work (fill as you learn)

- **OBJ orientation**: ALWAYS check facing direction before placing camera
- **Daylight env**: Ground gradient visible = not space. Use texture env with starfield.
- **Eclipse/backlight**: Matte sphere + backlight = no visible corona without bloom post-processing
- **`set_camera()` resets up vector**: It always resets to (0,1,0). The original workaround (flip up to -1,0 + attribute-based camera) was fragile and caused 180° flips every refresh. **FIX: Don't flip up. Rotate the cat model instead.**
- **Cat face points +Y**: Original approach flipped camera up to (0,-1,0) — WRONG. Correct approach: rotate cat model to face camera with standard up vector.
- **Cat rotation 190° on Y**: Shows the correct side of the model to camera.
- **Atmosphere shell glow**: Emissive thin shell around Earth didn't produce visible horizon glow at this camera distance. Needs different approach (volumetric medium or post-processing bloom).
- **Flipped up vector was wrong approach**: Cat faces +Y, so I flipped camera up to (0,-1,0). This broke `set_camera()` (always resets to 0,1,0), causing 180° flips every refresh. **FIX: Rotate the cat model instead. Keep standard up vector (0,1,0).** This likely also fixes the inverted Earth.
- **Earth appears inverted**: Was caused by flipped camera up vector (0,-1,0). **FIXED** — standard up vector (0,1,0) renders Earth correctly. Asia visible and properly oriented.
- **Deferred eval crash risk**: Too many `evaluate: false` calls (12+) including geo group→RT connection can crash Octane (ECONNRESET). Keep deferred batches smaller or evaluate between structural connections.
