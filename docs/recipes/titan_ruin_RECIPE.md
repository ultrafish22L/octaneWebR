# Titan Ruin (Fallen Robot Head)

> These recipes are creative direction, not rigid scripts. The values below are a starting point — deviate, experiment, and improve. The only goal is a render that makes you say _wow_.

## The Vision

A colossal fallen robot head, half-buried in earth, overgrown with vines and moss. Cracked face plate, rusted metal, ancient machinery reclaimed by nature. Golden hour light cuts across the scene from low angle — warm sun catching rusted metal edges while cool shadow fills the crevices. The scale is cathedral. This was a giant. Now it's a hill.

**Scale and decay are everything.** The robot head should feel the size of a building — achieved through camera placement (close, low, looking up) and the density of the overgrowth. This is environmental storytelling: a civilization fell here.

**Golden hour is THE look.** Warm directional sunlight from one side, raking across the rusted surface, catching every edge and crevice. Cool blue-sky fill from the opposite side. Deep shadows in the eye sockets and cracks. Classic two-light portrait but with a planet-sized subject.

**Camera: ground level, looking up.** We're in the dirt at the robot's level, slightly to one side. The cracked face plate looms over us. Vines cascade down. One cracked eye socket is visible. The horizon line cuts the robot roughly in half — bottom half buried, top half against sky.

---

## Build Order (DRESS mode)

### Step 1 — RT + Infra

Create `NT_RENDERTARGET`. Create `NT_KERN_DIRECTLIGHTING`. Connect kernel → RT (`pin_id: 89`).

Set film resolution 1000x1000.

**Environment**: Solid sky color (no texture needed). Create `NT_ENV_DAYLIGHT` OR a simple texture env with a deep blue gradient. Actually — use a simple ambient: create `NT_ENV_TEXTURE`, create `NT_TEX_FLOAT`, set value to 0.3, connect float → env (pin 0), connect env → RT (`pin_id: 43`). This gives a dim blue-grey ambient.

Set hero camera: pos (3, 1, 8), target (0, 2, 0). Pull back to z=-30 first.

Start render.

**Set DOF off**: RT → pin 0 → pin 14 → `set_attribute(handle, 185, AT_FLOAT=9, 0)`.

> **Render 1**: Grey ambient. DOF off.

### Step 2 — Robot head + golden key light

Create `NT_GEO_GROUP`. Set `A_PIN_COUNT = 8`. Connect geo group → RT (`pin_index: 3`).

**Golden key light** (sun, low angle from right):

Create `NT_LIGHT_QUAD`. Create `NT_MAT_DIFFUSE`. Create `NT_EMIS_TEXTURE`.

- Set efficiency (pin 0) to warm golden: `set_attribute(eff, 185, AT_FLOAT3=11, {x:1.0, y:0.8, z:0.4})`
- Set power to **30000**
- Set size to **2**
- Translation: **(12, 5, -8)** — far right, low, behind and to the side
- Connect → geo group (`pin_index: 0`)

**Robot head mesh** (Input 2):

Create `NT_GEO_MESH`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\titan_ruin.obj`, `A_RELOAD`.

Create `NT_TEX_IMAGE`. Set `A_FILENAME` to `C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\titan_ruin_tex.png`, `A_RELOAD`.

Create `NT_MAT_UNIVERSAL`. Connect texture → albedo (`pin_index: 2`). Connect material → mesh (`pin_index: 0`).

Create `NT_GEO_PLACEMENT`. Connect mesh → placement (`pin_name: "geometry"`). Set transforms:

- Translation: (0, -2, 0) — partially buried
- Rotation: (0, 15, -5) **DEGREES** — slight tilt, fallen
- Scale: (5, 5, 5)

Connect placement → geo group (`pin_index: 1`).

`set_camera` to trigger refresh.

> **Render 2**: Robot head with golden sun lighting. Check orientation.

### Step 3 — Cool sky fill

**Sky fill** (cool blue from opposite side):

Create `NT_LIGHT_QUAD`. Create `NT_MAT_DIFFUSE`. Create `NT_EMIS_TEXTURE`.

- Set efficiency (pin 0) to cool sky blue: `set_attribute(eff, 185, AT_FLOAT3=11, {x:0.4, y:0.6, z:1.0})`
- Set power to **5000**
- Set size to **10** — large diffuse fill
- Translation: **(-10, 8, 5)** — high left, opposite the sun
- Connect → geo group (`pin_index: 2`)

`set_camera` to trigger refresh.

> **Render 3**: Full golden hour. Warm/cool split. The shot.

---

## Ingredients

### Camera

| Setting    | Value                                    |
| ---------- | ---------------------------------------- |
| Position   | (3, 1, 8) — ground level, slightly right |
| Target     | (0, 2, 0) — looking up at face           |
| Up         | (0, 1, 0) — STANDARD                     |
| Resolution | 1000x1000                                |
| DOF        | Off (aperture=0)                         |

**Pull WAY back first** to find model orientation. Then move to ground-level hero angle.

### Environment

Dim blue-grey ambient (~0.3 power, grey color). Just enough to fill deep shadows slightly.

### Robot Head

| Setting  | Value                                             |
| -------- | ------------------------------------------------- |
| Mesh     | titan_ruin.obj (from OTOY Studio Hunyuan-3d v3.1) |
| Texture  | titan_ruin_tex.png                                |
| Rotation | Slight tilt (fallen) — check OBJ orientation      |
| Scale    | ~(5, 5, 5) — adjust to fill frame                 |
| Material | Universal mat + image texture                     |

**NOTE**: The source image shows heavy rust, moss, and vine overgrowth baked into the texture. Hunyuan should capture this surface detail well.

### Lights

| Light    | Position    | Power | Size | Color                   | Notes               |
| -------- | ----------- | ----- | ---- | ----------------------- | ------------------- |
| Sun key  | (12, 5, -8) | 30000 | 2    | Warm gold (1.0,0.8,0.4) | Low angle, hard     |
| Sky fill | (-10, 8, 5) | 5000  | 10   | Cool blue (0.4,0.6,1.0) | Soft, opposite side |

### Render

| Setting | Value           |
| ------- | --------------- |
| Kernel  | Direct Lighting |
| Samples | 5000            |

---

## Geo Group Slot Map

| Object     | Node Type        | Geo Group Slot |
| ---------- | ---------------- | -------------- |
| Sun key    | Quad light       | Input 1        |
| Robot head | Mesh + Placement | Input 2        |
| Sky fill   | Quad light       | Input 3        |

---

## What to Watch For

- **Scale illusion**: Tight FOV + low camera angle + slight upward tilt = massive scale feeling.
- **Translation Y**: Setting Y to -2 or lower gives the "buried" look.
- **Texture richness**: This model lives or dies by the baked rust/moss detail. If Hunyuan texture is clean, add a subtle grunge overlay texture node multiplied into the albedo.
- **Golden hour timing**: Sun key should produce long shadows across the face. Rotate X slightly (try 10-15°) to rake across surface features.
