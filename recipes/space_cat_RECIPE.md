# Space Cat (Demo Scene)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A cat astronaut floating in deep space, backlit by a distant sun. Earth curves below, massive and blue. The cat's spacesuit catches rim light — a bright corona outlining the figure against the void. Cinematic space photography. Think 2001, think Gravity, think that one shot everyone remembers.

**This is a hero portrait in space.** The cat astronaut is THE subject — everything else exists to frame it. Earth provides scale and color contrast (warm suit against cool blue planet). The sun provides drama (backlight rim). The starfield provides depth. Three supporting elements, one star.

**Backlight is THE look.** Sun behind the cat, toward the camera. Low ambient, strong rim highlights on the spacesuit edges. The figure reads as a silhouette with glowing edges — the classic astronaut-in-space shot. Front fill comes from Earth's reflected light (blue bounce) and the starfield environment at low power.

**Earth is a set piece, not a subject.** A huge sphere (scale 30+) filling part of the background, slightly below. Blue diffuse or textured. It's there for scale and color — don't center it, don't feature it. The cat is the subject. Earth is the backdrop.

**Off-axis camera, face the cat.** Check the OBJ orientation FIRST — don't shoot the cat's back. Place camera to see the face/helmet. The cat should feel like it's looking at us (or past us) while floating weightless.

---

## Build Order (Demo — DRESS mode)

_Verified build sequence. Follow exactly. No fumbling._

### Step 1 — RT + Infra

Create `NT_RENDERTARGET`. Create `NT_KERN_DIRECTLIGHTING`. Connect kernel → RT (`pin_id: 89`).

**No need to create imager** — RT auto-creates a default imager child at pin 10. All defaults (exposure=1, gamma=1, ACES=false). Do NOT call `create_node NT_IMAGER_CAMERA`.

**Set DOF off on the camera**: After `set_camera`, get the RT's camera node (pin 1 of RT) → get_node_info → find aperture pin → set to 0. Or: just confirm aperture=0 is default (it is). DOF off = aperture=0. **Verify this is set BEFORE connecting cat geo** or the render will be blurry.

Create `NT_ENV_TEXTURE`. Create `NT_TEX_IMAGE`, set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\starfield.jpg`, `A_RELOAD`. Set env power child to 0.4. Connect starfield → env (`pin_index: 0`). Connect env → RT (`pin_id: 43`).

Set film resolution to 1000x1000: `get_node_info(RT)` → pin 4 handle (film settings) → `get_node_info(film)` → pin 0 handle ("Image resolution") → `set_attribute(child, 185, AT_INT2=4, {x:1000, y:1000})`.

Set hero camera: pos (8.17, 13.30, 2.82), target (-1.07, 2.72, 6.52).

Start render (`render_target_handle: RT`).

**Set DOF off immediately**: RT camera is at RT pin 0 child → get_node_info → pin 14 = aperture child → `set_attribute(aperture_handle, 185, AT_FLOAT=9, 0)`. Default aperture is 0.893, NOT 0. Must be set explicitly.

> **Render 1**: Starfield. Scene is live. Hero framing is locked. DOF is off.

### Step 2 — Geo group + cat + key light

**CRITICAL: Fill geo group slots sequentially — no gaps. Gaps between filled slots crash update_scene.**

Slot assignments: Key=Input 1, Cat=Input 2, Earth=Input 3. **Only 3 slots** — the .orbx has exactly 1 light. No fill, no backlight.

Create `NT_GEO_GROUP`. Set `A_PIN_COUNT = 8`. Connect geo group → RT (`pin_index: 3`).

**Key light first** (Input 1 — light before geo, no ambient in space = black render):

Create `NT_LIGHT_QUAD`. Create `NT_MAT_DIFFUSE`. Create `NT_EMIS_TEXTURE`.

- Leave efficiency (pin 0) at default — auto-created white RGB color is correct
- Set power child (pin 1) to **15000**
- Connect emission → diffuse (`pin_id: 41`)
- Connect diffuse → quad light (`pin_index: 1`)
- Set size child (pin 0 of quad light) to **3**
- Set translation on transform child (pin 3 of quad light): **(10, 18, -15)**
- Connect quad light → geo group (`pin_name: "Input 1"`)

`set_camera` (same hero values) to trigger refresh.

> **Render 2**: Starfield + key light. Light is live. Ready for cat.

**Cat mesh** (Input 2):

Create `NT_GEO_MESH`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\cat_astronaut.obj`, `A_RELOAD`.

Create `NT_TEX_IMAGE`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\cat_astronaut_tex.png`, `A_RELOAD`.

Create `NT_MAT_UNIVERSAL`. Connect texture → material albedo (`pin_index: 2`). Connect material → mesh (`pin_index: 0`).

Create `NT_GEO_PLACEMENT`. Connect mesh → placement (`pin_name: "geometry"`). Set transforms on placement's transform child:

- Translation: (0.03, 2.16, 4.09)
- Rotation: (66.6, 140.4, 16.5) **DEGREES**
- Scale: (5, 5, 5)

Connect placement → geo group (`pin_name: "Input 2"`).

`set_camera` (same hero values) to trigger refresh.

> **Render 3**: Cat astronaut floating in space, textured and lit. Face toward camera.

### Step 3 — Earth

Create `NT_GEO_MESH`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\sphere_hd.obj`, `A_RELOAD`.

Create `NT_TEX_IMAGE`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\earth_daymap_8k.jpg`, `A_RELOAD`.

Create `NT_MAT_DIFFUSE`. Connect texture → material diffuse (`pin_id: 30`). Connect material → mesh (`pin_index: 0`).

Create `NT_GEO_PLACEMENT`. Connect mesh → placement (`pin_name: "geometry"`). Set transforms on placement's transform child:

- Translation: (2, -18, 5)
- Rotation: (314.2, 109.8, 44.5) **DEGREES**
- Scale: (30, 30, 30)

Connect placement → geo group (`pin_name: "Input 3"`).

> **Render 4**: Earth curves below. Scale. Color contrast. The shot.

`set_camera` (same hero values) to trigger refresh.

---

## Directions (legacy reference)

_7 renders. Each one a visible change. Brisk, not rushed._

---

## Ingredients

_Living values — refined each time the scene is built._

### Camera

| Setting    | Value                                        |
| ---------- | -------------------------------------------- |
| Position   | (8.17, 13.30, 2.82)                          |
| Target     | (-1.07, 2.72, 6.52)                          |
| Up         | (0, 1, 0) — STANDARD                         |
| FOV        | 39.598°                                      |
| Resolution | 1000x1000 interactive (square)               |
| Beauty     | 1000x1000                                    |
| DOF        | Off (aperture=0) — **VERIFY before cat geo** |

**NOTE**: Camera above and to the right, looking down at cat — dramatic hero angle. Up vector is standard (0,1,0). `set_camera()` works normally.

**DOF**: Default aperture is **0.893 (NOT 0)** — DOF is ON by default. Must explicitly set to 0. RT camera node pin 14 = aperture child → `set_attribute(aperture_handle, 185, AT_FLOAT=9, 0)`. Do this immediately after `start_render` or the render will be blurry.

### Environment

| Setting | Value                     | Notes                    |
| ------- | ------------------------- | ------------------------ |
| Texture | ORBX/assets/starfield.jpg | Sparse starfield         |
| Power   | 0.4                       | Very low — space is dark |

### Cat Astronaut

| Setting  | Value                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Mesh     | cat_astronaut.obj                                                         |
| Texture  | cat_astronaut_tex.png                                                     |
| Position | (0.03, 2.16, 4.09)                                                        |
| Rotation | (66.6, 140.4, 16.5) DEGREES — user-tuned in Octane for face-toward-camera |
| Scale    | (5, 5, 5)                                                                 |
| Material | Universal mat + image texture                                             |
| Face     | Points +Y natively. A_ROTATION uses DEGREES, not radians!                 |

### Earth

| Setting  | Value                                                    |
| -------- | -------------------------------------------------------- |
| Mesh     | sphere_hd.obj                                            |
| Position | (2, -18, 5)                                              |
| Rotation | (314.2, 109.8, 44.5) DEGREES — user-tuned continent view |
| Scale    | (30, 30, 30)                                             |
| Material | Diffuse + earth_daymap_8k.jpg                            |

### Lights

| Light | Position      | Power | Size | Notes                                   |
| ----- | ------------- | ----- | ---- | --------------------------------------- |
| Key   | (10, 18, -15) | 15000 | 3    | Geo group Input 1. Verified from .orbx. |

**1 light only** — verified from .orbx. No fill, no backlight. Adding extra lights simultaneously crashes Octane (ECONNRESET).

NT_LIGHT_QUAD + NT_MAT_DIFFUSE + **NT_EMIS_TEXTURE** (NOT blackbody — blackbody at same power values is 40x+ brighter). Positioned outside camera frame — no object layer needed.

### Render

| Setting | Value                                    |
| ------- | ---------------------------------------- |
| Samples | 5000                                     |
| Kernel  | Direct Lighting (NT_KERN_DIRECTLIGHTING) |
| Imager  | NT_IMAGER_CAMERA, all defaults           |

---

## Geo Group Slot Map

_Slot assignments are fixed. Node handles are session-specific and change every restart — don't document them._

| Object    | Node Type        | Geo Group Slot |
| --------- | ---------------- | -------------- |
| Key Light | Quad light       | Input 1        |
| Cat       | Mesh + Placement | Input 2        |
| Earth     | Mesh + Placement | Input 3        |

**Only 3 slots** — 1 key light only. No fill, no backlight. Verified from .orbx.

**CRITICAL**: Slots must be filled sequentially with no gaps — empty slots between filled slots crash `update_scene` (ECONNRESET).

_Cat material = Universal + RGB image texture. Earth material = Diffuse + RGB image texture. Key light: Diffuse material with **Texture emission** (NT_EMIS_TEXTURE, not blackbody). No object layer needed — light placed outside camera frame._

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
- **Cat rotation 190° on Y**: Was only correct for original camera angle. Final user-tuned rotation is (66.6, 140.4, 16.5) degrees.
- **A_ROTATION uses DEGREES not radians**: Critical — 90 means 90°, not 1.5708. Radians produce negligible rotation.
- **Atmosphere shell glow**: Emissive thin shell around Earth didn't produce visible horizon glow at this camera distance. Needs different approach (volumetric medium or post-processing bloom).
- **Flipped up vector was wrong approach**: Cat faces +Y, so I flipped camera up to (0,-1,0). This broke `set_camera()` (always resets to 0,1,0), causing 180° flips every refresh. **FIX: Rotate the cat model instead. Keep standard up vector (0,1,0).** This likely also fixes the inverted Earth.
- **Earth appears inverted**: Was caused by flipped camera up vector (0,-1,0). **FIXED** — standard up vector (0,1,0) renders Earth correctly. Asia visible and properly oriented.
- **Deferred eval crash risk**: Too many `evaluate: false` calls (12+) including geo group→RT connection can crash Octane (ECONNRESET). Keep deferred batches smaller or evaluate between structural connections.
- **Geo group slot gaps crash update_scene**: Filling non-sequential slots (e.g. Input 1 + Input 3 with Input 2 empty) causes ECONNRESET on `update_scene`. Always fill slots in order: 1, 2, 3… with no gaps. Slot order: Key=1, Cat=2, Earth=3.
- **Multiple lights crash**: Adding 2+ lights simultaneously then calling update_scene + set_camera = ECONNRESET every time. Root cause: recipe incorrectly specified 3 lights; .orbx has exactly 1. Use 1 key light only.
- **DOF blurry render**: Default aperture is 0.893 (NOT 0) — DOF is on by default. Must explicitly set camera aperture pin to 0 after start_render. RT camera is at pin 0 of RT (handle varies), pin 14 = aperture child. `set_attribute(aperture_handle, 185, AT_FLOAT=9, 0)`.
- **NT_EMIS_BLACKBODY = blown-out render**: Used blackbody emission instead of texture emission. Blackbody with efficiency=1.0 and temperature ~6500K outputs 40x+ more luminance than NT_EMIS_TEXTURE at the same power value. Always use NT_EMIS_TEXTURE. The .orbx imager is present but all defaults (exposure=1, gamma=1, ACES=false) — it is not the cause of overexposure.
- **Wrong kernel**: Used NT_KERN_PATHTRACING but .orbx uses NT_KERN_DIRECTLIGHTING. Always use DL kernel.
- **Relative texture paths**: `assets/earth_daymap_8k.jpg` failed with `:rgba` suffix error. Always use absolute paths: `C:\\otoyla\\GRPC\\dev\\octaneWebR\\ORBX\\assets\\file.ext`.
- **Starfield texture not reloading**: Must call `A_RELOAD=124` after `A_FILENAME=34` on image textures, same as meshes. Without reload, texture is missing.
- **Black render in space**: No environment light + no quad lights = pure black. Must create and connect at least one light before adding geometry.
- **Build timing**: Full DRESS build from empty scene = **3m 51s** (231s wall clock, 2s gRPC, 229s Claude thinking). 99% of time is not Octane.
