# Week 4 — MCP for front-office staff (working reference)

Working versions of the Week 4 lab. The real files ship as **student stubs** so the
room builds this live; copy these back if you get stuck or to run the finished demo.

    cp solutions/week4-mcp/pii.ts      lib/pii.ts
    cp solutions/week4-mcp/calendar.ts lib/calendar.ts
    cp solutions/week4-mcp/index.ts    mcp-server/index.ts

Restore student state (stubs) when you're done demoing:

    git checkout HEAD -- lib/pii.ts lib/calendar.ts mcp-server/index.ts

---

## The context: why this MCP is for front-office staff

The whole idea of Week 4 is **channels**. Which *door* a request comes through
decides what it may see — there is no login and there are no roles.

- **Chat door (clinician-facing):** returns the full chart. Real names, full notes.
- **MCP door (front-office staff):** *always* obscures. Staff — schedulers, the
  front desk — never need the clinical record to do their job, so the MCP channel
  only exposes **non-identifying tools** and scrubs every response on the way out
  (`obscureContent` / `obscureName`). The door can stay open with no auth because
  the room behind it is empty of PII — "the emptied room."

So what *does* a front-office person do all day? Two things, and both are tools here:

1. **Look things up** without seeing the chart — `query_notes` (semantic search,
   names obscured).
2. **Take an action** — *book appointments*. Booking is not chart-reading; the
   staff member already has the patient's name because they're scheduling them.
   That's why `schedule_appointment` belongs on this channel even though it echoes
   a real name: obscuring guards *retrieved clinical data*, not an action
   confirmation of data the caller themselves supplied.

That reframing — **staff act, they don't read** — is the point of the whole build.
The killer workflow, entirely inside a tool the staff already use (Claude):

> "What's open Aug 6? Book Carmen Escobar at the first slot."
> Claude calls `check_availability` → gets real slots → calls `schedule_appointment`.

## What's in this folder

- **`index.ts`** — the MCP server with all three tools:
  - `query_notes` — semantic search over clinical notes, PII-obscured (given example).
  - `check_availability({ date })` — open Cal.com slots for a day (reuses `getAvailableSlots`).
  - `schedule_appointment({ patientName, dateTime, notes? })` — books via Cal.com.
- **`calendar.ts`** — Cal.com **v2** client (`Bearer` auth + `cal-api-version` header;
  v1 is decommissioned). `scheduleAppointment` + `getAvailableSlots`.
- **`pii.ts`** — the de-identifier the obscured channel depends on.

You **can't pick a time, you pick a slot.** Cal only accepts a `start` that is an
actual open availability slot — that's why `check_availability` feeds
`schedule_appointment`. A hardcoded time (e.g. `09:00`) outside the availability
window is rejected with *"not available."*

---

## Running it — two ways, neither needs the chat app

Both spawn `mcp-server/index.ts` over stdio. First load env into your shell (raw
`ts-node` does **not** read `.env`):

    set -a; . ./.env; set +a

### 1. MCP Inspector (the "studio") — local, visual, no Claude

    npx @modelcontextprotocol/inspector npx ts-node mcp-server/index.ts

First run downloads the inspector, then opens a local browser page:

1. **Connect** (top-left) — the server starts, handshake completes.
2. **Tools** tab → **List Tools** → you'll see the three tools.
3. Pick one → fill inputs → **Run** → inspect the raw result.

Safe call to demo: **`check_availability`** with a date like `2026-08-06`
(read-only, repeatable). `schedule_appointment` creates a **real booking**.
If the server errors on Connect, the keys aren't reaching it — either run the
`set -a` line above first, or paste them into the Inspector's **Environment
Variables** fields before connecting.

### 2. Claude Desktop — the real "a model I don't control called my tool"

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

    {
      "mcpServers": {
        "medical-rag": {
          "command": "npx",
          "args": ["ts-node", "/ABSOLUTE/PATH/to/parsity_medical_rag/mcp-server/index.ts"],
          "env": {
            "DATABASE_URL": "postgresql://...",
            "OPENAI_API_KEY": "sk-...",
            "OPENAI_BASE_URL": "https://<your-litellm-proxy>",
            "PINECONE_API_KEY": "...",
            "CAL_API_KEY": "cal_...",
            "CAL_EVENT_TYPE_ID": "123456"
          }
        }
      }
    }

Gotchas that cost the most time:
- The subprocess **inherits no environment** — every key must be in this `env`
  block, even though it's already in `.env` (Claude launches from an arbitrary
  directory). If you use a LiteLLM/OpenAI proxy, `OPENAI_BASE_URL` **must** be here
  too, or embeddings hit `api.openai.com` and the key is rejected.
- Use an **absolute path** to `index.ts`.
- **Fully quit** Claude (Cmd-Q) and reopen after any edit — window-close is not a
  restart; the config is read only at launch.
- The config file must be **valid JSON** or Claude silently drops all servers.
- Tail the log: `tail -f ~/Library/Logs/Claude/mcp-server-medical-rag.log`

Then open a new chat → the tools appear in the 🔌 menu → ask it to check
availability and book someone.
