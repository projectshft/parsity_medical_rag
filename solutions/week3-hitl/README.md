# Week 3 — working HITL / scheduling reference (fallback if the live build stalls)

These are the WORKING versions. Copy back over the real files if you get stuck:
  cp solutions/week3-hitl/route.ts      app/api/chat/route.ts
  cp solutions/week3-hitl/selector.ts   lib/agents/selector.ts
  cp solutions/week3-hitl/scheduling.ts lib/scheduling.ts
  cp solutions/week3-hitl/page.tsx      app/page.tsx

What they do:
- selector: routes { useSql, useRag, needsSearch, needsAppt } — needsAppt = booking
- route: needsAppt → detectSchedulingIntent(query, messages) → aggregate streams a
  confirmation, action rides in the X-Scheduling-Action header (NOT appended to the body)
- scheduling: detect + extract (name/date/time) in one structured-output call; takes
  history so "schedule HIM" resolves to the patient from earlier in the chat
- page.tsx: reads the X-Scheduling-Action header → pops the confirm card
