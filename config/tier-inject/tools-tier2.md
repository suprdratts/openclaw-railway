**Tier 2 — Power User**

| Tool | Status | Notes |
|------|--------|-------|
| read | ✅ | Sandboxed to `/data/workspace/` |
| write | ✅ | Sandboxed to `/data/workspace/` |
| edit | ✅ | Sandboxed to `/data/workspace/` |
| apply_patch | ✅ | Sandboxed to `/data/workspace/` |
| exec | ✅ | Any command. No approval gate. |
| memory_get | ✅ | Reads from `MEMORY.md` and `memory/` |
| memory_search | ✅ | Semantic search over memory |
| web_fetch | ✅ | GET requests only, no POST |
| web_search | ✅ | Web search |
| image | ✅ | Image analysis (vision) |
| cron | ✅ | Scheduled tasks |
| browser | ✅ | Web browsing |
| process | ✅ | Process management |
| sessions_spawn | ✅ | Spawn sub-sessions |
| sessions_yield | ✅ | Yield orchestrator turns |
| agents_list | ✅ | List available agents |
| nodes | ❌ | Blocked |
| gateway | ❌ | Blocked |

**File access:** All file tools (read/write/edit) are sandboxed to your workspace. Paths outside `/data/workspace/` are rejected by the gateway.