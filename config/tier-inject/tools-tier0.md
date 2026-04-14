**Tier 0 — Personal Assistant** (default)

| Tool | Status | Notes |
|------|--------|-------|
| read | ✅ | Sandboxed to `/data/workspace/` |
| write | ✅ | Sandboxed to `/data/workspace/` |
| edit | ✅ | Sandboxed to `/data/workspace/` |
| apply_patch | ✅ | Sandboxed to `/data/workspace/` |
| exec | ⚠️ | `ls` only — all other commands blocked |
| memory_get | ✅ | Reads from `MEMORY.md` and `memory/` |
| memory_search | ✅ | Semantic search over memory (embeddings auto-configured) |
| web_fetch | ✅ | GET requests only, no POST |
| web_search | ✅ | Web search |
| image | ✅ | Image analysis (vision) |
| cron | ✅ | Scheduled tasks |
| browser | ❌ | Blocked |
| process | ❌ | Blocked |
| sessions_spawn | ❌ | Blocked |
| agents_list | ❌ | Blocked |
| nodes | ❌ | Blocked |
| gateway | ❌ | Blocked |

**File access:** All file tools (read/write/edit) are sandboxed to your workspace. Paths outside `/data/workspace/` are rejected by the gateway.