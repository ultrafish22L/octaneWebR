# OTOY Studio REST API — Full Model Catalog & Vision Models

**Date:** 2026-03-21
**Discovery method:** Browser network interception on `otoy.studio` (authenticated as john.cooke@otoy.com)

## TL;DR

The OTOY Studio MCP server exposes ~10 tools. The underlying REST API at `otoy.studio/api/models` serves **1,094 models** across **38 categories** — including a `vision` category with 29 image-understanding models that the MCP tool doesn't expose at all.

---

## API Endpoint

```
GET https://otoy.studio/api/models?category=<category>
```

**Valid categories:**
`all`, `text-to-image`, `image-to-image`, `text-to-video`, `video-to-video`, `image-to-video`, `image-to-3d`

(The validation error only lists these, but the response data contains 38 actual categories — the endpoint accepts `all` and returns everything.)

---

## Category Breakdown (1,094 models)

| Category        | Count |     | Category        | Count  |
| --------------- | ----- | --- | --------------- | ------ |
| image-to-image  | 305   |     | text-to-audio   | 60     |
| image-to-video  | 167   |     | text-to-speech  | 45     |
| video-to-video  | 140   |     | training        | 40     |
| text-to-image   | 129   |     | **vision**      | **29** |
| text-to-video   | 101   |     | image-to-3d     | 28     |
| utility         | 100   |     | upscale         | 24     |
| edit            | 75    |     | audio-to-audio  | 23     |
| removal         | 23    |     | llm             | 12     |
| audio-to-video  | 11    |     | text-to-music   | 11     |
| speech-to-text  | 9     |     | 3d-to-3d        | 8      |
| json            | 6     |     | text-to-3d      | 6      |
| text-to-json    | 4     |     | video-to-audio  | 4      |
| text-to-sfx     | 3     |     | audio-to-text   | 3      |
| unknown         | 3     |     | image-to-json   | 2      |
| audio           | 2     |     | music           | 2      |
| video-to-text   | 2     |     | speech-to-id    | 2      |
| json-to-image   | 1     |     | util            | 1      |
| text-to-text    | 1     |     | video-to-lottie | 1      |
| image-to-lottie | 1     |     | embedding       | 1      |

---

## Vision Models (29)

### Primary: `any-llm/vision` (VLM Router)

The most flexible vision model — routes to 11 different VLMs. Accepts an image URL + text prompt, returns text analysis.

**Input Schema (`VisionInput`):**

| Field           | Type    | Required | Description                                           |
| --------------- | ------- | -------- | ----------------------------------------------------- |
| `image_url`     | string  | Yes      | URL of the image to analyze                           |
| `prompt`        | string  | Yes      | Question or instruction about the image               |
| `model`         | enum    | No       | Which VLM to use (default: `google/gemini-flash-1.5`) |
| `system_prompt` | string  | No       | System prompt for the model                           |
| `reasoning`     | boolean | No       | Include reasoning in output                           |

**Available models in `any-llm/vision`:**

| Model                                      | Tier               |
| ------------------------------------------ | ------------------ |
| `google/gemini-flash-1.5`                  | Standard (default) |
| `google/gemini-flash-1.5-8b`               | Standard           |
| `google/gemini-2.0-flash-001`              | Standard           |
| `meta-llama/llama-4-maverick`              | Standard           |
| `meta-llama/llama-4-scout`                 | Standard           |
| `anthropic/claude-3.7-sonnet`              | Premium (3x)       |
| `anthropic/claude-3.5-sonnet`              | Premium (3x)       |
| `anthropic/claude-3-haiku`                 | Premium (3x)       |
| `google/gemini-pro-1.5`                    | Premium (3x)       |
| `openai/gpt-4o`                            | Premium (3x)       |
| `meta-llama/llama-3.2-90b-vision-instruct` | Premium (3x)       |

**Doc URL:** https://otoy.ai/models/fal-ai/any-llm/vision/api

---

### All 29 Vision Models

| Model                                | Path                                     | Description                                         | Key Inputs                                              |
| ------------------------------------ | ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| **Any LLM**                          | `any-llm/vision`                         | VLM router for visual understanding                 | `image_url`, `prompt`, `model`                          |
| **Any LLM (Vision)**                 | `any-llm`                                | Vision via LLMs (text-only variant)                 | `prompt`, `model`                                       |
| **Arbiter (Image)**                  | `arbiter/image`                          | Unified perception — text + image understanding     | `inputs`, `prompt`, `measurements`                      |
| **Arbiter (Image-Image)**            | `arbiter/image/image`                    | Visual analyzer — objects, structure, scene context | `inputs`, `prompt`, `measurements`                      |
| **Arbiter (Image-Text)**             | `arbiter/image/text`                     | Extracts text from complex visual inputs            | `inputs`, `prompt`, `measurements`                      |
| **Easel AI Fashion Size**            | `fashion-size-estimator`                 | Body image → clothing size predictions              | `image_url`, `prompt`                                   |
| **Florence 2 Large (Detailed)**      | `florence-2-large/detailed-caption`      | Detailed image captions                             | `image_url`, `prompt`                                   |
| **Florence 2 Large (More Detailed)** | `florence-2-large/more-detailed-caption` | Highly detailed image captions                      | `image_url`, `prompt`                                   |
| **Florence 2 Large (Region→Cat)**    | `florence-2-large/region-to-category`    | Region to category classification                   | `image_url`, `prompt`                                   |
| **Florence 2 Large (Region→Desc)**   | `florence-2-large/region-to-description` | Region to natural language description              | `image_url`, `prompt`                                   |
| **GOT-OCR v2**                       | `got-ocr/v2`                             | OCR for docs, tables, charts, formulas, sheet music | `input_image_urls`, `prompt`, `do_format`, `multi_page` |
| **Half Moon AI Detect**              | `ai-detector/detect-image`               | AI-generated image detection                        | `image_url`, `prompt`                                   |
| **ImageUtils NSFW**                  | `imageutils/nsfw`                        | NSFW content prediction                             | `image_url`, `prompt`                                   |
| **LLava Next**                       | `llava-next`                             | Vision-language model                               | `image_url`, `prompt`                                   |
| **Moondream 2**                      | `moondream/batched`                      | Batched visual understanding                        | `image_url`, `prompt`                                   |
| **Moondream 2**                      | `moondream`                              | Visual query answering                              | `image_url`, `prompt`                                   |
| **Moondream 2 (Object Det)**         | `moondream/object-detection`             | Object detection in images                          | `image_url`, `prompt`                                   |
| **Moondream 2 (Point Det)**          | `moondream/point-object-detection`       | Point-based object detection                        | `image_url`, `prompt`                                   |
| **Moondream 2 (Visual Query)**       | `moondream/visual-query`                 | Visual question answering                           | `image_url`, `prompt`                                   |
| **Moondream Next**                   | `moondream-next`                         | Next-gen visual understanding                       | `image_url`, `prompt`                                   |
| **Moondream Next (Batch)**           | `moondream-next/batch`                   | Batched next-gen visual understanding               | `image_url`, `prompt`                                   |

_(Plus additional specialized vision models — use `category=all` to get the full live list.)_

---

## Other Perception Categories (not exposed by MCP)

### video-to-text (2 models)

| Model                           | Path                      | Description                      |
| ------------------------------- | ------------------------- | -------------------------------- |
| OpenRouter - Video              | `router/video`            | Video → text descriptions        |
| OpenRouter - Video [Enterprise] | `router/video/enterprise` | Enterprise-grade video summaries |

### audio-to-text (3 models)

| Model                 | Path                  | Description                       |
| --------------------- | --------------------- | --------------------------------- |
| Nemotron ASR          | `nemotron/asr`        | Speech → text transcription       |
| Nemotron ASR (Stream) | `nemotron/asr/stream` | Real-time streaming transcription |
| Silero VAD            | `silero-vad`          | Voice activity detection          |

### speech-to-text (9 models)

Includes Whisper variants, ElevenLabs Scribe, and more.

### LLM (12 models)

Includes Moondream v3 Preview (caption, detect, point, query, segment, ocr), Bytedance Seed v2 Mini, Any LLM Enterprise, and others.

---

## MCP Coverage Gap

The current `otoy-studio` MCP server exposes these tools:

| MCP Tool                  | Maps to                           |
| ------------------------- | --------------------------------- |
| `generate_image`          | ~1 of 129 text-to-image models    |
| `generate_image_pro`      | ~1 of 129 text-to-image models    |
| `generate_image_nano`     | ~1 of 129 text-to-image models    |
| `edit_image`              | ~1 of 305 image-to-image models   |
| `edit_image_nano`         | ~1 of 305 image-to-image models   |
| `generate_video_veo3`     | ~1 of 101 text-to-video models    |
| `generate_video_kling`    | ~1 of 101 text-to-video models    |
| `generate_video_seedance` | ~1 of 101 text-to-video models    |
| `image_to_video_kling`    | ~1 of 167 image-to-video models   |
| `chat_completion`         | ~30 of 12+ LLM models (text-only) |
| `generate_music`          | ~1 of 11 music models             |
| `upscale_image`           | ~1 of 24 upscale models           |
| `upscale_video`           | ~1 of 24 upscale models           |

**Not covered at all by MCP:**

- `vision` (29 models) — image understanding / VLM
- `video-to-text` (2 models) — video understanding
- `audio-to-text` (3 models) — transcription
- `speech-to-text` (9 models) — speech recognition
- `image-to-3d` (28 models) — only 1 exposed via `generate_3d`
- `text-to-3d` (6 models)
- `3d-to-3d` (8 models)
- `text-to-speech` (45 models)
- `text-to-audio` (60 models)
- `removal` (23 models) — background/object removal
- `training` (40 models) — fine-tuning
- `embedding` (1 model)
- And 10+ more categories

---

## Model Response Format

Each model in the API response includes:

```json
{
  "id": "690246984806504f9e098f11",
  "name": "Bytedance - Seed3d",
  "model_path": "bytedance/seed3d/image-to-3d",
  "category": ["image-to-3d"],
  "description": "Converts images into simulation-ready 3D assets.",
  "documentation_url": "https://otoy.ai/models/fal-ai/bytedance/seed3d/image-to-3d/api",
  "inputSchema": {
    /* full OpenAPI-style JSON Schema */
  },
  "schema": {
    /* full OpenAPI 3.0.4 spec */
  }
}
```

Each model has a complete OpenAPI spec with input/output schemas, making it possible to build a generic MCP tool that can call any of the 1,094 models dynamically.

---

## Key Takeaway

The OTOY Studio REST API is a massive model hub (1,094 models, 38 categories) built on fal.ai infrastructure. The MCP server only wraps ~13 of them. The `any-llm/vision` endpoint is the answer to the original question — it provides vision-to-text via 11 different VLMs, accepting `image_url` + `prompt` and returning text analysis. Default model is `google/gemini-flash-1.5` (free tier), with premium options including Claude 3.7 Sonnet, GPT-4o, and Llama 4.
