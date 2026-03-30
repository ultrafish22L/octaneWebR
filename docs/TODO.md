# TODO

## App

| Item                             | Details                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Electron log path                | `log_grpc.log` writes inside read-only asar. Use `app.getPath('userData')`.                                           |
| Connection LED false-green       | Shows connected when actually offline                                                                                 |
| Info bar: MCP + AD status        | Thin bar showing connection state, build mode (SHOP/DRESS/SHOW), AD on/off                                            |
| GATED error auto-refresh cache   | When a tool hits unknown-handle guard, auto-call `get_scene_tree` to repopulate before returning error                |
| In-memory render → Studio upload | `grabRenderResult` → encode PNG → upload. Skips disk I/O for vision critic. Needs Studio API support for raw buffers. |

## MCP

See `octaneServGrpc/docs/TODO.md` for unimplemented RPCs and SDK limitations.

| Item               | Details                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `import_materialx` | Calls `ApiMaterialXGlobal.importMaterialXFile` — not implemented in octaneServGrpc |
| LiveDB tools (4)   | Disabled — SDK gRPC compat layer doesn't handle singleton services                 |

## Deferred

| Item         | Details                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| SSO JWT auth | Scaffolded, blocked on auth team. See [mcp/SSO_JWT.md](mcp/SSO_JWT.md). |
