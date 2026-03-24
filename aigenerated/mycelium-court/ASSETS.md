# Mycelium Court — Asset Manifest

## Generated 3D Models (OTOY Studio Hunyuan-3d v3.1 Pro)

All assets stored in `ORBX/assets_test/`. GLBs are Z-up, require rotation {90,Y,0} on import.

| Asset               | GLB File               | OBJ (converted)                                | Texture                                    | Faces | Notes                                             |
| ------------------- | ---------------------- | ---------------------------------------------- | ------------------------------------------ | ----- | ------------------------------------------------- |
| Giant mushroom      | `giant_mushroom.glb`   | `assets/giant_mushroom/giant_mushroom.obj`     | `assets/giant_mushroom/Material.001.png`   | 500K  | Hero model, teal-blue cap with white spots        |
| Fairy character     | `fairy.glb`            | `assets/fairy/fairy.obj`                       | `assets/fairy/Material.001.png`            | 498K  | Sitting pose, green leaf dress, butterfly wings   |
| Mushroom cluster    | `mushroom_cluster.glb` | `assets/mushroom_cluster/mushroom_cluster.obj` | `assets/mushroom_cluster/Material.001.png` | 500K  | 3 red amanita mushrooms on mossy rock base        |
| Mossy rocks         | `mossy_rocks.glb`      | `assets/mossy_rocks/mossy_rocks.obj`           | `assets/mossy_rocks/Material.001.png`      | 500K  | 3-4 rounded boulders with green moss              |
| Fern/flower cluster | `ferns_flowers.glb`    | `assets/ferns_flowers/ferns_flowers.obj`       | `assets/ferns_flowers/Material.001.png`    | 495K  | Purple/blue bioluminescent wildflowers with ferns |

## AI-Generated Textures (OTOY Studio Flux Pro)

| Texture      | File                   | Purpose                                             |
| ------------ | ---------------------- | --------------------------------------------------- |
| Mushroom cap | `tex_mushroom_cap.jpg` | Bioluminescent teal/purple spots on organic surface |
| Mossy ground | `tex_moss_ground.jpg`  | Forest floor with leaves, twigs, small mushrooms    |
| Glowing bark | `tex_bark_glow.jpg`    | Ancient wood with cyan bioluminescent veins         |

## HDRI Environment (Poly Haven, CC0)

| File                 | Resolution | Size   | Source                             |
| -------------------- | ---------- | ------ | ---------------------------------- |
| `forest_hdri_2k.hdr` | 2048x1024  | 7.6MB  | Poly Haven "mossy_forest" — STABLE |
| `forest_hdri_4k.hdr` | 4096x2048  | 29.7MB | Same — higher quality, more VRAM   |

Download URL pattern: `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/{res}/mossy_forest_{res}.hdr`

## Concept Art References

| File                    | Description                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `ref_wide_forest.jpg`   | Wide establishing shot — mushroom forest, fairy sitting on mossy rock, golden hour backlight      |
| `ref_closeup_fairy.jpg` | Intimate angle — 3 giant pink mushrooms, fairy with wings, purple foreground flowers, warm sunset |

## 3D Reference Images (used for image-to-3d generation)

| File                       | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `ref_giant_mushroom.jpg`   | Isolated teal mushroom on white background              |
| `ref_fairy.jpg`            | Fairy character sitting pose on white background        |
| `ref_mushroom_cluster.jpg` | Red amanita cluster on mossy rock, white background     |
| `ref_mossy_rocks.jpg`      | Mossy boulder cluster, white background                 |
| `ref_ferns_flowers.jpg`    | Purple/blue flower cluster with ferns, white background |

## Render Progression

| File                         | Description           | Key Change                                      |
| ---------------------------- | --------------------- | ----------------------------------------------- |
| `render_01_mushroom.png`     | First mushroom import | Out of frame, no HDRI                           |
| `render_rebuild_02.png`      | Mushroom framed       | Camera pulled back, stalk visible               |
| `render_rebuild_03.png`      | 3 models              | Fairy + mushroom cluster added                  |
| `render_rebuild_05.png`      | Rocks added           | Mossy rocks filling ground                      |
| `render_rebuild_07_hero.png` | Hero angle v1         | Fairy visible among rocks                       |
| `render_v2_emission.png`     | Emission added        | Dark HDRI, glowing mushroom caps                |
| `render_v3_7mushrooms.png`   | Black render          | Project load broke file paths                   |
| `render_v10_final.png`       | Full scene v1         | 7 big + 8 small mushrooms, rocks, flowers       |
| `render_v12_base.png`        | Clean rebuild         | HDRI with spherical projection, emission at 0.4 |
| `render_v13_full.png`        | All instances         | 7 big + 8 small + 8 rocks                       |
| `render_v17_16x9.png`        | 16:9 aspect           | Ground textured, non-uniform mushroom scale     |
| `render_v18.png`             | HDRI rotated          | Warm golden backlight, spread mushrooms         |
| `render_v19_flowers.png`     | Flowers added         | Purple foreground framing                       |
| `render_v20_overview.png`    | Debug overhead        | Diorama view of full scene layout               |
| `render_v23.png`             | Final hero            | Fairy clear, flowers framing, caps towering     |
