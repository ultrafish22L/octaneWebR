# The Sword (Rune Blade)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A legendary fantasy sword floating in darkness. The blade glows with electric blue runes — the only light source in the scene. No ground, no background, just the weapon suspended in void, radiating cold power. Museum lighting meets arcane artifact. Think how a magic item feels in concept art before it becomes a game asset — mysterious, dangerous, beautiful.

**This is a product shot turned into fine art.** The sword is the only subject. Everything exists to reveal its form and the glow of the runes. No environment, no context — just the object and the light it creates.

**Rune glow is THE look.** The blue energy on the blade should be the primary light source. Rim light from above to reveal the golden crossguard and jeweled pommel. Deep shadow everywhere else. The void makes the blade feel weightless and dangerous.

**Camera: low angle, looking up the blade.** The sword is angled — tip toward the camera at roughly 45°. We're looking up from just below the crossguard level. The pommel hangs in shadow. The tip catches light. Creates the feeling of enormous scale even on a small object.

---

## Build Order (DRESS mode)

_Verified build sequence. Follow exactly._

### Step 1 — RT + Infra

Create `NT_RENDERTARGET`. Create `NT_KERN_DIRECTLIGHTING`. Connect kernel → RT (`pin_id: 89`).

Set film resolution to 1000x1000: RT → pin 4 (film) → pin 0 (resolution) → `set_attribute(child, 185, AT_INT2=4, {x:1000, y:1000})`.

**No environment** — pure black void. Do NOT connect an env node.

Set hero camera: pos (0, 2, 8), target (0, 1, 0). (Adjust after seeing model orientation.)

Start render.

**Set DOF off immediately**: RT → pin 0 (camera) → pin 14 (aperture) → `set_attribute(aperture_handle, 185, AT_FLOAT=9, 0)`. Default is 0.893, NOT 0.

> **Render 1**: Black void. Scene live. DOF off.

### Step 2 — Sword mesh + key rim light

**Key light first** (top-rear rim):

Create `NT_LIGHT_QUAD`. Create `NT_MAT_DIFFUSE`. Create `NT_EMIS_TEXTURE`.

- Set power child (pin 1) to **8000**
- Set size child (pin 0) to **1.5**
- Connect emission → diffuse (`pin_id: 41`), diffuse → quad (`pin_index: 1`)
- Set translation on transform child: **(0, 8, -6)** (above and behind)
- Connect quad → geo group (`pin_index: 0`)

Create `NT_GEO_GROUP`. Set `A_PIN_COUNT = 8`. Connect geo group → RT (`pin_index: 3`).

`set_camera` to trigger refresh.

> **Render 2**: Light only. White quad in void.

**Sword mesh** (Input 2):

Create `NT_GEO_MESH`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\sword.obj`, `A_RELOAD`.

Create `NT_TEX_IMAGE`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\sword_tex.png`, `A_RELOAD`.

Create `NT_MAT_UNIVERSAL`. Connect texture → material albedo (`pin_index: 2`). Connect material → mesh (`pin_index: 0`).

Create `NT_GEO_PLACEMENT`. Connect mesh → placement (`pin_name: "geometry"`). Set transforms:

- Translation: (0, 0, 0)
- Rotation: (0, 45, 0) **DEGREES** — diagonal in frame
- Scale: (5, 5, 5)

Connect placement → geo group (`pin_index: 1`).

`set_camera` to trigger refresh.

> **Render 3**: Sword in void, rim lit. Check orientation — tip should angle toward camera.

### Step 3 — Rune fill light (blue)

Create second `NT_LIGHT_QUAD`. Create `NT_MAT_DIFFUSE`. Create `NT_EMIS_TEXTURE`.

- Set efficiency child (pin 0) to blue: `set_attribute(efficiency_handle, 185, AT_FLOAT3=11, {x:0.2, y:0.5, z:1.0})`
- Set power child to **3000**
- Set size child to **4**
- Translation: **(2, 1, 3)** — in front, slightly right, close to blade
- Connect to geo group (`pin_index: 2`)

`set_camera` to trigger refresh.

> **Render 4**: Blue rune light fills blade. The glow.

---

## Ingredients

### Camera

| Setting    | Value                          |
| ---------- | ------------------------------ |
| Position   | (0, 2, 8) — adjust after model |
| Target     | (0, 1, 0)                      |
| Up         | (0, 1, 0) — STANDARD           |
| Resolution | 1000x1000                      |
| DOF        | Off (aperture=0)               |

**NOTE**: Pull camera WAY back first to see full model orientation. Then move in close.

### Environment

None — pure black void.

### Sword

| Setting  | Value                                        |
| -------- | -------------------------------------------- |
| Mesh     | sword.obj (from OTOY Studio Hunyuan-3d v3.1) |
| Texture  | sword_tex.png (or GLB embedded texture)      |
| Rotation | Tune after checking model facing direction   |
| Scale    | ~(5, 5, 5) — adjust to fill frame            |
| Material | Universal mat + image texture                |

**NOTE**: Check OBJ orientation before placing camera. The sword may face any direction from Hunyuan export.

### Lights

| Light     | Position   | Power | Size | Color            | Notes           |
| --------- | ---------- | ----- | ---- | ---------------- | --------------- |
| Key rim   | (0, 8, -6) | 8000  | 1.5  | White            | Top-rear, hard  |
| Rune fill | (2, 1, 3)  | 3000  | 4    | Blue (0.2,0.5,1) | Front soft fill |

### Render

| Setting | Value           |
| ------- | --------------- |
| Kernel  | Direct Lighting |
| Samples | 5000            |

---

## Geo Group Slot Map

| Object    | Node Type        | Geo Group Slot |
| --------- | ---------------- | -------------- |
| Key rim   | Quad light       | Input 1        |
| Sword     | Mesh + Placement | Input 2        |
| Rune fill | Quad light       | Input 3        |

**Fill slots sequentially — no gaps.**

---

## What to Watch For

- **GLB vs OBJ**: Hunyuan exports GLB. Need OBJ. Check if assets folder has `sword.obj`.
- **Rune glow**: The blue on the blade in the source image is texture — Hunyuan may or may not capture it. If not, the blue fill light creates the effect.
- **Orientation**: Sword likely needs rotation to angle tip toward camera at ~45°.
- **Scale**: Sword may be tiny by default. Scale up until it fills the frame.
