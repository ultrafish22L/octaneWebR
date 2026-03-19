# octaneWebR Quick Start (v2.0.0)

## Prerequisites

- **Node.js 18+**
- **Octane Render Studio 2026.1** with gRPC enabled (Preferences > GRPC API > Enable GRPC Server, address `127.0.0.1:51022`)

## Setup

```bash
npm install
cd mcp && npm install   # MCP server dependencies (separate package)
```

## Launch Octane First

Octane must be running before the dev server starts.

```bash
"C:/otoyla/GRPC/dev/octaneGRPC-2026.1-Alpha5/octane.exe" &
```

Load a scene in Octane and click a Render Target before connecting.

## Dev Server

```bash
npm run dev   # Vite on port 43929 (WORKER_1)
```

Open the URL shown in terminal. Status bar should show "Connected", scene tree populates, render image appears.

## MCP Server (AI Agent Tools)

```bash
cd mcp && npm run build && npm run mcp:start
```

Runs via stdio transport. 27 tools for scene building, camera, render, and node manipulation.

## Smoke Test

1. Load `ORBX/teapot.orbx` via File > Open
2. Select the Camera node in the outliner
3. Toggle the Orthographic checkbox in the inspector
4. Verify the value changes in both the UI and Octane viewport

## Environment Variables

| Variable            | Default     | Purpose                             |
| ------------------- | ----------- | ----------------------------------- |
| `OCTANE_BIND_HOST`  | `0.0.0.0`   | Network bind address for dev server |
| `OCTANE_FILE_ROOTS` | `C:\otoyla` | Allowed roots for file browser      |
| `OCTANE_HOST`       | `127.0.0.1` | Octane gRPC host                    |
| `OCTANE_PORT`       | `51022`     | Octane gRPC port                    |
| `WORKER_1`          | `43929`     | Vite dev server port                |

## Troubleshooting

| Problem          | Fix                                                   |
| ---------------- | ----------------------------------------------------- |
| Can't connect    | Octane running? gRPC enabled? Port 51022?             |
| Empty scene tree | Load a scene in Octane, then refresh (F5)             |
| Blank page       | Is `npm run dev` running? Check browser console (F12) |
