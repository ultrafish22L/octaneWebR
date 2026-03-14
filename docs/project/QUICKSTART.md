# octaneWebR Quick Start

## Prerequisites

- **Octane Render gRPC build** — https://filedrop.otoy.com/f/393752
- **Node.js 18+**

## Octane Setup

1. Launch Octane → File → Preferences
2. **GRPC API / Enable GRPC Server**: true
3. **GRPC API / GRPC Server Address**: `127.0.0.1:51022` → OK
4. Restart Octane, load a scene, click a Render Target

## Launch

```bash
npm install    # first time
npm run dev    # http://localhost:57341
```

## Verify

- Status bar shows **"Connected"**
- Scene tree populates in left panel
- Render image appears in viewport

## Troubleshooting

| Problem          | Fix                                           |
| ---------------- | --------------------------------------------- |
| Can't connect    | Octane running? LiveLink enabled? Port 51022? |
| Empty scene tree | Load scene in Octane, then F5                 |
| Blank page       | `npm run dev` running? Check console (F12)    |
