# OTOY Studio API

`OTOY_API_KEY` must be in env. Base URL: `https://que.otoy.studio`

---

## Quick Reference — REST API (primary method)

MCP tools (`mcp__otoy-studio__*`) require a remote MCP connection that may not be active. **Use REST directly** — it always works.

### Auth Pattern

```bash
curl -s -X POST "https://que.otoy.studio/r2/{endpoint}" \
  -H "ai: $OTOY_API_KEY" \
  -H "X-Signed-URL: 3600" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

### Image Generation (concept art)

```bash
# FLUX Pro — hero concept art
POST /r2/otoy-studio/flux-pro/new
{
  "prompt": "...",
  "image_size": "landscape_16_9",  # or "square_hd" for mesh concepts
  "num_inference_steps": 30,
  "guidance_scale": 4.0,
  "output_format": "png",
  "safety_tolerance": "5"
}
```

**Mesh concept images** should use `"square_hd"`, white background, isolated object, product photography style. This gives Hunyuan clean input.

### Image-to-3D (hero meshes)

```bash
# Hunyuan-3D v3.1 Pro — best quality + PBR
POST /r2/otoy-studio/hunyuan-3d/v3.1/pro/image-to-3d
{ "input_image_url": "...", "enable_pbr": true }
```

**⚠️ STATUS URL GOTCHA:** The submit response contains `status_url` and `response_url`. These use a DIFFERENT path than the submit endpoint:

- Submit: `/r2/otoy-studio/hunyuan-3d/v3.1/pro/image-to-3d`
- Status: `/r2/otoy-studio/hunyuan-3d/requests/{id}/status` (note: no `v3.1/pro`)
- Result: `/r2/otoy-studio/hunyuan-3d/requests/{id}`

**Always use the exact `status_url` from the submit response** — don't construct it manually.

### Async Job Pattern (all endpoints)

```
1. Submit → { request_id, status_url, response_url }
2. Poll status_url (with ai: header) every 10s → "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
3. Fetch response_url (with ai: + X-Signed-URL: headers) → signed download URLs
```

Image gen: ~6-12s. Image-to-3D: ~2-3 min.

**Download results** — signed URLs need no auth:

```bash
# Image gen result
response.images[0].url → download PNG

# Image-to-3D result
response.model_urls.obj.url → download OBJ
response.model_urls.glb.url → download GLB (optional)
response.thumbnail.url → download preview PNG
```

The OBJ comes with `material.mtl` referencing PBR textures. Download all to same directory.

### Endpoint Discovery

```bash
GET https://que.otoy.studio/api/endpoints?q=flux+pro     # keyword search
GET https://que.otoy.studio/api/endpoints?category=image-to-3d  # by category
```

Full docs for any endpoint:

```bash
curl -s "https://storage.otoy.ai/docs/{endpoint-id}/llms.txt"
# e.g. https://storage.otoy.ai/docs/flux-pro/new/llms.txt
```

---

## MCP Tools (when connected)

20 built-in tools — all async (return `request_id`, poll with `check_job`).

| Tool                 | Use for                                    |
| -------------------- | ------------------------------------------ |
| `generate_image_pro` | Hero concept art (flux/pro)                |
| `generate_image`     | Fast concept drafts (flux/schnell)         |
| `check_job`          | Poll any async job                         |
| `list_endpoints`     | Endpoint catalog                           |
| `get_endpoint_docs`  | Full docs for any endpoint by name/keyword |

**Any of the 1099+ endpoints** is accessible via MCP by using `get_endpoint_docs` to learn the API, then calling it directly via REST.

---

## Pipeline Integration (AD Scene Build)

```
1. Concept art — REST flux-pro/new → save concept_art.png
2. analyze_reference (Octane MCP) — extract composition
3. Mesh concepts — REST flux-pro/new (square_hd, white bg, isolated)
4. Image-to-3D — REST hunyuan-3d/v3.1/pro/image-to-3d → OBJ + textures
5. analyze_mesh (Octane MCP) → orientation check
6. attach_mesh (Octane MCP) → place in scene
```

**Parallel work:** Steps 3-4 take ~3 min. During that time, build scene infrastructure in Octane (RT, kernel, environment, floor).

**Do NOT use Chrome/browser for image-to-3D.** REST API replaces that workflow.
