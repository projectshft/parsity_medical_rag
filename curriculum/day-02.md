# Day 2 — Setup: Accounts, Keys, and a Running App

**Needs: GitHub account, Node 20+, and sign-ups for Neon, OpenAI, and Pinecone (all have free tiers)**

## Today you will

- Get the app running locally on the `student` branch
- Create the three accounts the system depends on and put their keys in `.env`
- Confirm your environment is healthy by running the test suite

## Concept

A RAG system is not one program — it's your code plus a few hosted services it calls. Before writing a line, you need accounts for each, because each hands you a secret key that your code reads from a `.env` file.

```mermaid
flowchart LR
    APP[Your app<br/>Next.js] -->|SQL| NEON[(Neon<br/>Postgres)]
    APP -->|vectors| PINE[(Pinecone)]
    APP -->|LLM + search| OAI[OpenAI]
```

Three services, three jobs:

| Service      | Job                                                                    | Why this one                                                      |
| ------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Neon**     | Hosted Postgres for structured data                                    | Serverless Postgres with a real free tier; no local DB to install |
| **OpenAI**   | Powers the LLM answers and the meaning-based search you'll build later | Industry-standard API, reliable structured output support         |
| **Pinecone** | Stores the searchable form of clinical notes                           | Managed vector database with a free starter index                 |

You won't _use_ all three today — you'll just wire them up so later days are pure building, not setup detours.

> **Why `.env` and not hardcoding keys?** A key in source code is a key in your git history forever, readable by anyone with repo access. `.env` is gitignored — it never leaves your machine. Leaking an OpenAI key means someone else spends your money; leaking a database URL means someone else reads your data. Treat `.env` like a password file, because it is one.

## Implementation

### 1. Get the code and install

```bash
git clone <repo-url> && cd medical-rag
git checkout student
npm install
```

### 2. Create the three accounts

Sign up for each (free tier is enough for the whole course), then grab the credential:

- **Neon** — [neon.tech](https://neon.tech) → create a project → copy the connection string from **Dashboard → Connection Details**. It looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/...`

    ![Screenshot: Neon dashboard showing the connection string panel](assets/day02-neon-connection.png)
      <!-- TODO(brian): capture from logged-in Neon dashboard -->


- **OpenAI** — [platform.openai.com](https://platform.openai.com) → **API keys** → create one. Starts with `sk-`. (Add a few dollars of credit; the whole course costs roughly the price of a coffee.)

- **Pinecone** — [pinecone.io](https://pinecone.io) → copy your API key. You'll create the actual index on a later day — today just grab the key.

### 3. Fill in `.env`

```bash
cp .env.example .env
```

Open `.env` and paste each value in. At minimum for today:

```
DATABASE_URL="postgresql://...your Neon string..."
OPENAI_API_KEY=sk-...your key...
PINECONE_API_KEY=...your key...
PINECONE_INDEX=medical-notes
```

### 4. Run it

```bash
npm run dev
```

Open the URL it prints (usually `http://localhost:3000`). You should see the **Medical Records Assistant** chat interface.

![Screenshot: the Medical Records Assistant chat UI running locally](assets/day02-app-running.png)

It won't _answer_ anything useful yet — the retrieval engines aren't built. A running, empty-handed app is exactly the right Day 2 outcome.

### 5. Confirm your environment with the tests

```bash
npm run test:run
```

You'll see a mix of passing and failing tests. **That is correct and intended** — the failures are the assignments waiting for you. What you're checking is that the suite _runs at all_ (Node, install, and TypeScript are healthy).

### Common mistakes

- **Quoting `DATABASE_URL` wrong.** Keep it in double quotes exactly as Neon gives it, `?sslmode=require` and all. A stray space or missing quote is the #1 Day 2 error.
- **Committing `.env`.** Run `git status` — if `.env` shows up, stop. It's gitignored by default; if you see it, you renamed something. Never commit secrets.
- **Wrong Node version.** Run `node --version`. Below 20 and Next.js will throw cryptic errors. Use `nvm install 20` if needed.
- **Pasting the OpenAI _project_ ID instead of the key.** The key starts with `sk-`. The project ID (`proj_...`) is not it.

## Your turn

Spend **no more than 20 minutes** here.

1. Get `npm run dev` showing the chat UI and `npm run test:run` executing (pass _and_ fail is fine).
2. In your course notes file, record the test summary line (e.g. "24 failed | 56 passed"). You'll watch that "failed" number shrink as you complete the course — it's your progress bar.
3. Run `git status` and confirm `.env` does **not** appear in the output.

## Check yourself

```bash
npm run dev        # chat UI loads at localhost:3000
npm run test:run   # suite runs to completion
git status         # .env is NOT listed
```

- Why does the app run but not answer questions yet?
- If a teammate accidentally commits their `.env`, what's the very next thing they should do?

<details>
<summary>Solution / discussion</summary>

**The app runs but can't answer** because the retrieval layer is empty: there's no data in Postgres yet, no searchable notes, and the query-routing code is still a skeleton. The _shell_ (UI, API routes, service connections) is wired; the _brain_ is what you'll build.

**If `.env` gets committed:** removing the file in a later commit is **not enough** — it's still in history. The key must be treated as compromised: **rotate it immediately** (delete and regenerate it in the OpenAI/Neon/Pinecone dashboard), then scrub history if the repo is shared. Rotation is the real fix; deletion just hides it.

**Expected test summary** on a fresh student branch: `Test Files 4 failed | 4 passed`, `Tests 24 failed | 148 passed` (the 24 are homework specs you'll complete later).

</details>

## Further reading (optional)

- [Neon docs: connection strings](https://neon.tech/docs/connect/connection-errors) — if your `DATABASE_URL` misbehaves
