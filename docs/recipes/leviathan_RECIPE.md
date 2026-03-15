# Deep Sea Leviathan

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A translucent deep-sea horror floating in the abyss. Bioluminescent organs pulse through its body — cyan and blue-green light glowing from within, casting cold light outward into crushing darkness. The creature is terrifying and beautiful simultaneously. Think _Alien_ meets deep-sea documentary, the kind of image that makes you afraid of the ocean.

**Bioluminescence IS the lighting rig.** No external key light. The creature lights itself and the surrounding water. The scene should feel like total darkness broken only by the creature's own cold fire.

**The creature should feel MASSIVE.** Low camera angle, creature filling most of the frame. Small bubbles or particles optional (can skip if they complicate the build). The creature's translucent body should show internal structure — ribs, organs, the lure filament.

**Camera: eye-level, slightly below.** Looking up at the creature slightly. The lure antenna hangs above frame. The jaw/fang array dominates the foreground. The bioluminescent glow creates a halo around the creature against absolute black.

---

## Build Order (DRESS mode)

### Step 1 — RT + Infra

Create `NT_RENDERTARGET`. Create `NT_KERN_DIRECTLIGHTING`. Connect kernel → RT (`pin_id: 89`).

Set film resolution to 1000x1000.

**No environment** — total black abyss. Do NOT connect an env node.

Set hero camera: pos (0, 0, 10), target (0, 0, 0). (Pull way back first to orient model.)

Start render.

**Set DOF off**: RT → pin 0 → pin 14 (aperture) → `set_attribute(handle, 185, AT_FLOAT=9, 0)`.

> **Render 1**: Black abyss. Scene live. DOF off.

### Step 2 — Creature + bioluminescent fill

Create `NT_GEO_GROUP`. Set `A_PIN_COUNT = 8`. Connect geo group → RT (`pin_index: 3`).

**Primary bioluminescent light** (cyan-green, large, soft — mimics creature's own glow):

Create `NT_LIGHT_QUAD`. Create `NT_MAT_DIFFUSE`. Create `NT_EMIS_TEXTURE`.

- Set efficiency (pin 0) to cyan-green: `set_attribute(eff, 185, AT_FLOAT3=11, {x:0.1, y:0.9, z:0.7})`
- Set power to **5000**
- Set size to **8**
- Translation: **(0, 0, 2)** — close and large, right in front of creature
- Connect → geo group (`pin_index: 0`)

**Creature mesh** (Input 2):

Create `NT_GEO_MESH`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\leviathan.obj`, `A_RELOAD`.

Create `NT_TEX_IMAGE`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\leviathan_tex.png`, `A_RELOAD`.

Create `NT_MAT_UNIVERSAL`. Connect texture → material albedo (`pin_index: 2`). Connect material → mesh (`pin_index: 0`).

Create `NT_GEO_PLACEMENT`. Connect mesh → placement (`pin_name: "geometry"`). Set transforms:

- Translation: (0, 0, 0)
- Rotation: (0, 0, 0) **DEGREES** — check orientation first
- Scale: (5, 5, 5)

Connect placement → geo group (`pin_index: 1`).

`set_camera` to trigger refresh.

> **Render 2**: Creature emerges from the black. Bioluminescent glow.

### Step 3 — Lure light + deep accent

**Lure light** (the glowing antenna tip — bright point, cold blue):

Create `NT_LIGHT_QUAD`. Create `NT_MAT_DIFFUSE`. Create `NT_EMIS_TEXTURE`.

- Set efficiency (pin 0) to cold blue: `set_attribute(eff, 185, AT_FLOAT3=11, {x:0.3, y:0.6, z:1.0})`
- Set power to **20000**
- Set size to **0.3** — tiny bright point
- Translation: position near creature's lure antenna tip (above and forward)
- Connect → geo group (`pin_index: 2`)

`set_camera` to trigger refresh.

> **Render 3**: Lure light adds the hot spot. The creature glows.

---

## Ingredients

### Camera

| Setting    | Value                        |
| ---------- | ---------------------------- |
| Position   | (0, -1, 10) — slightly below |
| Target     | (0, 0, 0)                    |
| Up         | (0, 1, 0) — STANDARD         |
| Resolution | 1000x1000                    |
| DOF        | Off (aperture=0)             |

**Start pulled WAY back** to find and orient the creature first.

### Environment

None — total black abyss.

### Leviathan

| Setting  | Value                                            |
| -------- | ------------------------------------------------ |
| Mesh     | leviathan.obj (from OTOY Studio Hunyuan-3d v3.1) |
| Texture  | leviathan_tex.png                                |
| Rotation | Check facing — should look toward camera         |
| Scale    | ~(5, 5, 5) — creature should fill frame          |
| Material | Universal mat + image texture                    |

**NOTE**: The source image shows a translucent body. Hunyuan will model the silhouette and surface. The translucency effect will come from the lighting — strong internal-feeling glow.

### Lights

| Light            | Position  | Power | Size | Color                    | Notes             |
| ---------------- | --------- | ----- | ---- | ------------------------ | ----------------- |
| Bio fill (large) | (0, 0, 2) | 5000  | 8    | Cyan-green (0.1,0.9,0.7) | Soft overall glow |
| Lure point       | Near lure | 20000 | 0.3  | Cold blue (0.3,0.6,1.0)  | Hot spot on lure  |

### Render

| Setting | Value           |
| ------- | --------------- |
| Kernel  | Direct Lighting |
| Samples | 5000            |

---

## Geo Group Slot Map

| Object    | Node Type        | Geo Group Slot |
| --------- | ---------------- | -------------- |
| Bio fill  | Quad light       | Input 1        |
| Leviathan | Mesh + Placement | Input 2        |
| Lure      | Quad light       | Input 3        |

---

## What to Watch For

- **Black render**: No env + no lights before geo = black. Create bio fill light BEFORE connecting creature.
- **Creature facing**: Check OBJ forward direction before finalizing camera. Rotate to face camera.
- **Scale**: Deep sea creatures feel bigger when camera is slightly below, looking up.
- **Material**: If Hunyuan includes texture maps, use them. If not, Universal mat with a subtle cyan tint can carry the look.
