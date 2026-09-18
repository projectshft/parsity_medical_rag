# Chronological Course-Update Brief: RAG Medical Records Project

## Purpose and scope

This brief condenses a multi-session, hands-on course sequence in which learners build a medical-records RAG application. The project begins with existing patient data in Postgres, vectorizes clinical notes into Pinecone, adds retrieval and reranking, routes requests between SQL and vector search, aggregates answers in a chat interface, supports human-confirmed appointment scheduling through Cal.com, adds LangSmith observability, and finally exposes functionality through an MCP server. The course concludes by shifting learners toward independent capstone projects.

The class repeatedly emphasizes that the hard part is not producing code quickly. It is understanding the data, choosing the right retrieval path, observing failures, and iterating on a small, reliable workflow rather than assuming an “agent” will solve everything autonomously.

---

# Session 1 — Project setup, RAG foundations, embeddings, and ingestion

## Learning objectives

By the end of the first class, learners should be able to:

- Set up the course repository and required service accounts.
- Explain the medical-office product scenario and why RAG is needed.
- Distinguish existing structured SQL data from unstructured clinical-note retrieval.
- Define RAG as retrieving relevant context and augmenting an LLM response with it; understand that RAG does not inherently require a vector database.
- Explain embeddings, semantic similarity, cosine similarity, `topK`, dimensions, and metadata at a practical level.
- Create embeddings with `text-embedding-3-small` and store note embeddings plus metadata in Pinecone.
- Safely validate a small ingestion run before uploading the full data set.

## Course operating model and learner expectations

- The course is hands-on and has weekly homework: a short technical implementation plus a video explanation using the Feynman technique. Learners should explain what they built and why, not merely show generated code.
- Encourage questions in Slack and class. Public questions and public homework videos let the cohort learn from alternative approaches.
- Office hours are available synchronously and asynchronously; questions can be submitted for recorded answers.
- The instructor expects learners to use AI coding tools if useful, but still be able to explain the system in interviews or at work.

## Setup steps and services

1. Clone the public repository and switch to the `student` branch.
2. Run `npm install` / `npm i`.
3. Add the supplied environment values, including the course OpenAI-compatible API key/base URL and the read-only database URL.
4. Run `npm run db generate` to generate Prisma client types for the existing database.
5. Optionally run `npm run dev` and open the local app on port 3000. The provided chat UI is intentionally incomplete; the course concentrates on backend/RAG behavior.
6. Create a Pinecone account. Pinecone is the shared vector-store choice for the class because it is easy to start with.
7. Create a Cal.com account for later appointment scheduling. It is not required for the first ingestion work.
8. Optional tools mentioned for exploring data: Neon as the managed Postgres host and DBeaver as a database browser.

### Setup-related concepts to retain

- The course database is read-only and represents an existing clinical system. Learners are not rebuilding the source database; they are adding an AI-facing layer over existing data.
- Prisma is used as an ORM so the application can query Postgres in TypeScript without hand-writing every SQL query.
- The provided API-key arrangement is meant to simplify the learner experience. Learners can substitute their own OpenAI API setup, but then they must configure their own keys/base URL and pay for use.

## Product scenario and architecture introduced

The fictional customer is a medical clinic with hundreds of patients and roughly 21,000 historical clinical notes. Patient data already lives in SQL. Doctors and front-office staff need to ask questions such as:

- What did we last discuss with this patient?
- Which patients show signs of breathing problems, cognitive decline, or another clinical pattern?
- What should a clinician know before seeing a particular patient?
- Which patients need follow-up?

The planned product has multiple access paths:

- A clinician chat interface.
- A future MCP integration so front-office staff can interact through Claude.
- SQL for structured facts and vector retrieval for semantically meaningful note text.
- Later scheduling through Cal.com, with an optional future voice-AI follow-up.

The key architectural message: do not treat a vector store as a replacement for SQL. SQL remains the system for exact, structured information. Vector retrieval makes large bodies of note text searchable by meaning. A useful system often uses both.

## RAG explanation and demo

The instructor demonstrates that a general LLM cannot answer clinic-specific questions without access to the clinic’s information. A question such as “What patients are short of breath?” cannot be answered from generic model training. The solution is to retrieve relevant internal context and provide it to the model before it responds.

The class manually selects a patient’s SQL notes, pastes them into an LLM, and asks for a summary. This demonstrates the value: the model can summarize years of notes quickly, but the manual workflow is not acceptable for a clinician. The application’s job is to retrieve the right notes and provide them automatically.

Important framing to preserve:

- RAG can be simple: giving an LLM retrieved Google Drive data is RAG.
- RAG can be more complex: combine a structured SQL query and semantic vector retrieval before generating an answer.
- The LLM should generate from retrieved context, not pretend it already knows an organization’s private data.

## Embeddings and vector search

### Core concepts taught

- An embedding converts text into a vector: a long array of numbers representing semantic characteristics of the text.
- Vector stores compare the embedded query against stored embedded documents and return the nearest matches.
- Semantic search is not exact matching. It can find clinically related language even when the user’s phrasing does not literally appear in a note.
- Pinecone returns the closest `topK` matches and a similarity score. A result can be the closest available match without being meaningfully relevant; later retrieval-quality controls are necessary.
- Cosine similarity is the practical comparison mechanism used in the course. Learners do not need to derive the linear algebra, but should understand that it compares directional similarity between vectors.

### Important learner questions and answers

- **Does a smaller search circle / lower `topK` mean more precise answers?** Not exactly. It returns fewer nearest candidates; the last candidate can still be poor. Use scores and later quality controls to avoid irrelevant retrieval.
- **Must one embedding model be used consistently?** Yes. Documents and queries must be embedded with the same model and compatible dimensions. Changing models generally means re-vectorizing the corpus.
- **Can text and images use different embedding models?** Potentially, but a multimodal system must handle how a query is embedded against each modality. This was acknowledged as more complex than the course’s text-only example.
- **What is a vector dimension?** One number in the embedding array. More dimensions can capture more nuance, but selection depends on data type, cost, and retrieval needs.

### Embedding implementation choices

- Use OpenAI-compatible embeddings through the provided client helper.
- Use `text-embedding-3-small`.
- Batch embedding requests rather than sending one item at a time.
- Use 1,536 dimensions for the clinical-note corpus as the course default. The class characterizes 512 dimensions as potentially sufficient for simpler/shorter text, and 3,072 as a possible choice for more nuanced text such as legal content. Treat 1,536 as a starting default, not universal truth.
- The course includes an `npm run similarity` exercise. Learners modify a query and candidate texts, run the script, inspect cosine similarity scores, and compare observed ranking with intuition.

### Demo/exercise: similarity script

The script embeds a query and a list of candidate sentences, then computes similarity locally. It is both a conceptual exercise and an environment test for the OpenAI API setup.

Learners observed surprising or unstable-looking rankings on short, contrived sentences. Preserve this as a teaching point: embedding behavior is model-mediated and should be evaluated on real task data rather than assumed from toy examples.

## Metadata design before ingestion

The class collaboratively designs a `MedicalChunk`-style record. Each vector record contains:

- A stable note ID.
- `content`: the clinical note text that is actually embedded.
- Metadata, including patient ID, first/last name, age, gender, race, city, state, source (`Postgres`), and current medications where available.

Key distinction:

- **Content** is embedded and supports semantic similarity.
- **Metadata** is stored as key/value data and supports hard filtering in addition to vector search.

The group debates whether to include source, names, location, race, age, and medications. The decision is to err toward retaining useful metadata initially because the SQL source makes re-indexing feasible. Highly detailed structured data, such as medication dosage, may remain more appropriate in SQL.

Design principle introduced: metadata should reflect who will use the system and how they will ask questions. Do not vectorize blindly without considering future filtering needs.

## Ingestion implementation and demo

### Flow

1. Query notes from Prisma, including the patient fields and current medications needed for metadata.
2. Transform notes into vector-store records.
3. Embed only note content.
4. Upsert each record’s ID, vector, and metadata to Pinecone.
5. Batch uploads in groups of 100.
6. Inspect Pinecone to verify records, metadata, and dense-vector values.

### Safety decision

First upload only five records. Inspect them in Pinecone before removing the `take: 5` test limit and processing all roughly 21,090 notes. This is explicitly framed as cost and correctness protection: avoid spending credits or corrupting an index with a bad transformation.

### Implementation/debugging issues observed

- Learners confused “notes” from Postgres with “chunks” built for vectorization. In this data set, notes are already short/self-contained, so they are effectively used as chunks; no true splitting occurs yet.
- Prisma relationship/TypeScript errors occurred around medications because a relation was queried or named incorrectly. The instructor supplied the working query/file and advised learners to replace the full script when needed.
- A learner had not saved the updated vectorization file; running the old stub caused “stub would vectorize five” behavior.
- Learners accidentally retained `take: 5`, yielding only five vectors after a successful test.
- A typo in a Pinecone environment variable caused a failure.
- Some `.env` values were not loaded by the script. A temporary terminal `export` workaround was used, but this should not be the canonical course path.
- Full uploads suffered connection resets/flaky-network errors, often stopping around 102 records or uploading only part of the corpus. Some learners succeeded, others progressed slowly with retries.
- Deleting/re-running an index can create duplicate records if IDs are not handled carefully. The class treated small duplicates as tolerable for learning, but recognized this is not production practice.

### Curriculum improvements suggested by Session 1

- Provide a preflight checklist before class: Node/NPM, repository branch, `.env` placement, `npm install`, `npm run db generate`, service accounts, and how to confirm each key is loaded.
- Ship a tested, complete vectorization script before live class. Teach the flow by reading the script and changing selected fields rather than building the complicated Prisma query live.
- Include a clear terminology callout: **source notes → retrieval records/chunks → embeddings + metadata**. Explicitly state that this particular first data set does not need chunking.
- Add an ingestion status command/dashboard and expected totals: test count = 5; full count ≈ 21,090. Learners should know that Pinecone’s count may lag while indexing.
- Add robust retries with exponential backoff, per-batch progress logging, resumability/checkpointing, and idempotent IDs. If a simple timeout between batches is used as an initial workaround, label it as a throughput tradeoff rather than a complete fix.
- Provide a reset/reindex procedure that avoids manual record deletion and makes duplicate behavior explicit.
- Validate required environment variables at startup with actionable error messages instead of troubleshooting `export` commands live.
- Avoid putting sensitive API/database values in meeting chat or screenshare. Use per-learner credentials or a documented secure distribution method.

## Homework: Bible chunking and vectorization project

Learners are asked to build a separate Pinecone index from Bible text. The text is chosen because it is publicly available and provides a large, structured corpus.

Assignment requirements:

- Choose and implement a chunking strategy.
- Choose useful metadata.
- Vectorize into a separate Pinecone index.
- Record a short video explaining the approach, rationale, results, and possible alternative chunking strategies.

The assignment is intended to take no more than a couple of hours and to force learners to adapt the pattern to a different data shape.

### Chunking concepts introduced

- Do not split solely at arbitrary character counts if it cuts sentences and destroys meaning.
- Use document structure where available: Bible book, chapter, verse; similarly, other corpora may have paragraphs, headings, sections, or records.
- If size limits are needed, preserve sentence boundaries.
- Metadata might include book, chapter, verse/reference, testament, or domain-specific markers such as red-letter text.
- Chunking should be driven by source structure and intended retrieval behavior, not a universal fixed size.

---

# Session 2 — Chunking review, retrieval endpoint, reranking, and routing design

## Learning objectives

Learners should be able to:

- Evaluate chunking approaches and overlap.
- Build a basic Pinecone retrieval function and expose it through a Next.js API route.
- Understand `topK`, metadata inclusion, score inspection, metadata filtering, and reranking.
- Decide whether a query belongs in SQL, vector search, or both.
- Explain the selector/workflow pattern and why a constrained workflow is often preferable to an autonomous tool-using agent.
- Begin returning structured routing decisions rather than parsing prose from an LLM.

## Homework review: what learners did and what it revealed

One learner chunked Bible text by structural boundaries, grouping verses under a target size, keeping overlap, never crossing chapters/books, and adding testament/book/chapter/readable-reference metadata. This is the desired reasoning pattern: use source structure, preserve context, and audit output.

Another learner attempted semantic chunking by making many embedding/API calls and grouping verses by a similarity threshold. The result contained unexpectedly huge chunks and inconsistent runs. A toy similarity exercise also produced unstable-looking results, including an implausible 1.0 score in one run and a different ranking in another.

Teaching takeaway: black-box embedding APIs must be evaluated with output audits and retrieval tests. Cheap embedding cost does not remove the need for validation. Course materials should include basic checks such as chunk-length distributions, outlier detection, boundary validation, sample review, and repeatability checks.

## Chunk overlap

The class revisits why overlap matters:

- A source unit may begin or end in the middle of a sentence or thought.
- Neighboring sentences provide semantic context that may otherwise be lost.
- Overlap can make adjacent conceptual material more likely to remain retrievable together.

Keep this as a practical rule: preserve enough neighboring context to avoid retrieval of isolated fragments, but do not present overlap as a magic fix for weak chunk design.

## Build: basic vector search service

### Retrieval flow

1. Receive a user’s text query.
2. Embed the query using the **same** embedding model and dimensions used during ingestion.
3. Query the Pinecone index with the embedded query.
4. Choose an initial `topK` (the class begins with five, later explores larger values).
5. Request `includeMetadata: true`.
6. Return/inspect the matches.

The class creates a `vectorSearch.ts` / `searchClinicalNotes` service and a Next.js `app/api/search/route.ts` POST endpoint. Learners test it using Postman, another HTTP client, or `curl`.

### Critical gotcha

Without `includeMetadata: true`, Pinecone returns IDs, scores, and vector-related values but not the human-readable note content or metadata. Learners initially received results that were technically valid but useless for an application.

### Learner confusion worth preserving

- A learner asked where the new route should live. The instructor explicitly walked through `app/api/search/route.ts`.
- A learner did not know the local server command; the answer was `npm run dev`.
- Learners used differing index names. The correct configuration must use each learner’s actual Pinecone index, not an instructor-specific example name.

### Curriculum improvements

- Include a route/file-tree diagram and copyable tested request examples before live coding.
- Make index name an environment variable everywhere; avoid hard-coding instructor index names in examples.
- Provide a “raw result vs useful result” before/after screenshot demonstrating `includeMetadata`.

## Retrieval quality, metadata filters, and reranking

The first retrieval result for a query such as “Tell me about patients with breathing issues” returns semantically related note snippets and scores, but it is not necessarily sufficient for clinician-quality answers.

Important ideas:

- Similarity scores need interpretation and task-specific evaluation. Scores around the same value do not automatically mean results are equally useful.
- A name or exact patient lookup should not be left entirely to fuzzy vector search. Patient IDs and structured patient data already exist in SQL and metadata.
- Metadata filters can constrain vector search, e.g., a patient, age, gender, race, location, or other indexed field.
- Different information belongs in different places: exact patient/entity/attribute retrieval is generally SQL-friendly; clinical narratives and semantic symptoms are vector-search-friendly.

### Two-stage retrieval / reranking

The course adds a Pinecone reranker:

1. Overfetch a broad set of semantically relevant candidates (for example, 100).
2. Convert each returned candidate to a text representation containing note text and selected metadata.
3. Send the original query plus candidates to Pinecone’s reranking model (`bge-reranker-v2-m3` in the class example).
4. Return the best `topN` reranked candidates (for example, 10).

Key terminology:

- `topK`: number of initial vector-search candidates.
- `topN`: number of reranked candidates retained afterward.

The instructor explicitly frames reranking as a practical MVP pattern, not a guaranteed quality solution. It can reduce what is passed to a downstream LLM, but must be evaluated against real use cases.

### Reranking issues exposed live

- Missing/case-mismatched metadata fields caused `firstName`/`lastName` to become `undefined`.
- Some patient ages/dates appeared misleading or poorly formatted.
- Reranking did not obviously improve a “today”/recency-style query, partly because note date information was not being used in a retrieval-friendly way.
- Overfetching too many documents exceeded a reranker document limit.
- Repeated/near-duplicate note text reduced the apparent value of reranking.

### Curriculum improvements

- Treat reranking as an experiment with explicit evaluation questions rather than a universal enhancement.
- Add a retrieval test set with expected relevant notes and task categories: semantic condition search, exact patient lookup, recent-note questions, demographic filters, and irrelevant queries.
- Teach date normalization/recency as a separate retrieval concern. If recency matters, index/query it intentionally rather than expecting semantic search alone to infer “today.”
- Include typed metadata definitions and a validation step to catch casing/field-name mismatches before queries reach Pinecone.
- State provider/document limits in the starter code and enforce safe defaults.

## Architecture decision: SQL + vector search + aggregation

The class evolves the system toward this flow:

`User query → selector → SQL search and/or vector search → aggregate results → stream answer`

The selector decides whether to use SQL, vector retrieval, both, or neither/clarification. SQL and vector search can run in parallel when independent. An aggregator summarizes retrieved information for the clinician.

Example guidance:

- “How many patients have hypertension?” → structured SQL.
- “Which patients show signs of cognitive decline?” → vector/RAG retrieval.
- “Tell me about a named patient and their note history.” → potentially SQL plus vector retrieval.
- A request unrelated to the clinical data should be clarified or declined rather than routed to either source.

## Agent/workflow framing

The instructor distinguishes a true autonomous agent from the course’s intended workflow:

- A highly autonomous agent repeatedly chooses tools and decides when it is done. It can be slow, costly, opaque, and hard to constrain.
- The course system is a constrained workflow: decide which data source(s) to use, retrieve, aggregate, and optionally initiate a scheduling flow.

Important course position: a workflow is often what a company needs first. Avoid building a general-purpose autonomous agent when the task has known, bounded paths.

## Selector agent prototype

The selector is introduced as an LLM API call with one narrow responsibility: route a query. It needs context about:

- What is stored in the vector store (clinical notes).
- What is stored in SQL (structured patient data).
- What actions are available.
- What a valid routing choice looks like.

The first prototype returns prose such as “This query should be answered by the vector store.” The class immediately identifies the problem: application code should not parse a free-form sentence to decide its next action.

The next step is structured output, eventually represented through a schema with fields such as:

- `useSQL`
- `useRAG`
- `useScheduler`
- `reason`
- `agentQuery` (an optimized retrieval query)
- `clarificationQuery`

This is a major curriculum principle: use JSON/structured outputs for machine decisions. Do not rely on fragile prose parsing.

---

# Session 3 — End-to-end agent workflow, LangSmith, SQL generation, aggregation, scheduling, and safety

## Learning objectives

Learners should be able to:

- Wire the chat UI to the selector, SQL agent, vector retrieval, and aggregator.
- Explain routing, parallelization, aggregation, and human-in-the-loop patterns.
- Use structured outputs and agent context intentionally.
- Explain model settings such as temperature, conversation history, max tokens, and prompt caching considerations.
- Add LangSmith tracing for observability.
- Build a human-confirmed Cal.com scheduling path.
- Identify core data/privacy constraints for medical data.

## End-to-end target architecture

The class presents the intended experience:

1. User asks a question in the chat UI.
2. Selector produces a structured plan: SQL, RAG, both, scheduling, or clarification.
3. SQL and vector retrieval run as needed, preferably in parallel when neither depends on the other.
4. Aggregator receives the user query, recent conversation history, and retrieved results.
5. Aggregator summarizes the retrieved data and streams the response to the UI.
6. A scheduling request short-circuits retrieval and produces a proposed appointment action for human confirmation.

## Why avoid long chains of dependent agents

The class discusses latency and token cost, then focuses on the more fundamental issue: each agent step is fallible. If one step’s output is required for the next, reliability compounds downward. The instructor uses a “telephone” analogy: chained transformations can gradually distort information.

Course design implication:

- Give each agent a single responsibility.
- Prefer parallel independent work to unnecessary sequential chains.
- Do not create one “god agent” that performs every action.
- Allow sequential/chained routing only when it provides a clear benefit, such as using SQL to narrow a corpus before a vector search. Treat it as an explicit latency/quality tradeoff.

## Human-in-the-loop scheduling

The scheduling feature is used to teach human-in-the-loop design.

The agent can identify a patient, date, time, and reason, but it should not autonomously create appointments without review. The UI should show a proposed action and require a user to confirm or reject it. The instructor’s rule is that the more consequential or irreversible an action is, the more strongly it needs human confirmation.

This principle generalizes beyond appointments: do not give unreviewed autonomous agents the ability to alter databases, commit funds, contact third parties, or perform other high-impact actions.

## Anatomy of an LLM agent call

The class breaks an agent into practical components:

- **System prompt / instructions:** what the task is and what boundaries apply.
- **Context:** the data, options, schema, examples, and domain details needed to make a good decision.
- **Model and settings:** model choice, temperature, token constraints.
- **Structured output:** JSON/schema when an application needs to take the result programmatically.
- **Conversation history:** recent messages needed to resolve follow-ups such as “list them,” “schedule her,” or “tell me more.”

Key points:

- An LLM is stateless across calls. Pass appropriate history; the class uses an initial heuristic of the last five messages.
- Temperature controls randomness. Use low/zero temperature for deterministic extraction/routing tasks; allow more variation where the task is natural-language synthesis.
- `max_tokens` caps output length/cost but is not the central control in the class implementation.
- System prompts may be cacheable. Keep stable instructions at the beginning and avoid placing dynamic variables at the start if provider caching depends on prompt prefixes.
- Avoid relying on role-play phrasing such as “You are a helpful assistant” as the main prompt strategy. Give direct task instructions, the available context, and expected outputs.

## SQL agent implementation

The instructor provides a starter `SQL.ts` implementation rather than live-building the full SQL-generation logic. It is described as MVP-quality and not safe enough for production code review.

The SQL agent’s intended responsibility is narrow:

1. Receive the user question and database/schema context.
2. Produce SQL appropriate to the supported read-only database.
3. Application code executes the SQL.
4. Results are passed to the aggregator.

The SQL implementation later evolves to introspect schema information dynamically rather than hard-code a schema snapshot. This keeps the agent informed when columns, tables, or relationships change.

### Curriculum improvement

Do not normalize unsafe generated SQL as acceptable. Add a dedicated guardrail module/lesson before execution: read-only role, allowlisted statements/tables, query validation, parameterization where applicable, row/time limits, logging, and failure behavior. Keep the course’s MVP code, but label the unsafe boundaries clearly and provide a production hardening checklist.

## Selector schema and routing behavior

The selector’s output controls whether to use SQL, RAG, scheduling, clarification, or combinations. It can also normalize/optimize the retrieval query to correct spelling/grammar and make retrieval intent more explicit.

Live tests expose expected early failures:

- A named patient’s history was routed to SQL when vector notes were also needed.
- A follow-up such as “I meant his notes” changed routing but produced missing/undefined retrieval output.
- A general treatment question routed incorrectly or returned weak context.

This is intentional course material: the first agent workflow should be a visibly imperfect MVP. Learners should identify where failure occurs—selector, query extraction, SQL, vector search, reranker, aggregator, or UI—and improve one component at a time.

## Aggregator agent and streaming

The aggregator is explicitly a “dumb agent”: it does not retrieve. It receives query, conversation history, and the SQL/RAG result text and turns that into a clinician-readable answer.

Its core guardrails:

- Use only supplied/retrieved information.
- Do not invent or infer unsupported medical information.
- State plainly when the retrieved data is insufficient.
- Preserve population statistics accurately when present.

The app streams the aggregator response to the frontend using the AI SDK/OpenAI streaming primitives. Streaming improves perceived latency and creates the chat-style UX, but the main educational goal is the backend workflow.

### Important failure demonstrated

An answer about a named patient returned information about a different patient. Another answer about cardiac issues gave a weak result because RAG was not selected. These demonstrate that a fluent final answer is not evidence that routing/retrieval worked.

### Curriculum improvements

- Add a visible “retrieval trace” in the UI/dev mode: plan selected, SQL executed, filters used, top retrieved note IDs, reranking status, and aggregation input size.
- Give learners a worksheet for classifying failures before editing prompts.
- Introduce a small fixed set of acceptance questions early, then reuse it in every session to measure whether changes improved or regressed behavior.

## LangSmith observability

Learners create a LangSmith project and API key, add environment values, and wrap the OpenAI client so requests are automatically traced.

The intended observability uses:

- Inspect model inputs/outputs.
- See selector choices and tool calls.
- Measure latency and token costs.
- Discover how users actually ask questions.
- Later run evaluations.

The class compares LangSmith to an AI-focused Datadog-like observability tool. The course uses a minimal wrapper rather than a custom logging system.

### Curriculum improvements

- Provide a single prebuilt tracing wrapper and exact `.env` keys.
- Add a trace-reading exercise: find one bad answer, identify whether the failure began in selection, retrieval, or aggregation, and propose a corrective experiment.
- Make privacy implications explicit before learners send any sensitive data to a tracing service.

## Scheduling implementation and streaming complication

The scheduler detects appointment intent and extracts patient name, date, time, and reason. The route should short-circuit normal SQL/RAG retrieval when scheduling is the sole request.

The live implementation exposes a practical issue: the frontend expects streamed text, but the scheduling flow also needs structured action data to render a calendar/confirmation component. The class explores passing a serialized scheduling action in response headers or embedding/recognizing structured scheduling markers in the stream. The implementation remains incomplete/fragile during class.

Do not treat this as a final pattern without refinement. The curriculum should present a clean, tested protocol for stream text plus structured UI actions rather than live improvisation.

## Cal.com integration issues

- The course initially used an outdated/incorrect version of Cal.com API documentation.
- Learners spent time on payload mismatches, especially patient email/front-end payload changes.
- Once the correct API version and documentation were used, the integration was comparatively straightforward.

### Curriculum improvements

- Pin the Cal.com API version and provide a verified request/response fixture.
- Separate the scheduling integration from LLM routing. First prove a direct schedule button works with static test data; only then connect agent-extracted scheduling intent.
- Keep confirmation mandatory in the starter UI.

## Privacy, retention, and medical-data Q&A

A learner asks whether clinical information sent to the LLM could enter training data. The answer given is that there is a real data-handling concern unless the provider contract/configuration provides appropriate protections.

Options discussed in the transcript:

- Enterprise arrangements with zero data retention.
- Opting out of training; distinguish this from zero retention.
- Obscuring patient information as a partial mitigation, not necessarily full compliance.
- Hosting an open-source model when policy requires it, acknowledging this creates operational/maintenance work.

Course-update requirement: replace informal claims with a clear scoped statement. The exercise uses synthetic data. Real medical/legal deployments require organization-specific security, retention, contractual, and compliance review before data is sent to model, vector, tracing, or other third-party services.

---

# Session 4 — Improving the MVP, few-shot prompts, MCP/tool calling, and capstone planning

## Learning objectives

Learners should be able to:

- Diagnose common end-to-end agent failures and improve routing/retrieval behavior.
- Use few-shot examples for routing and metadata-filter extraction.
- Understand context-window limits and model selection.
- Explain MCP as a protocol for exposing callable tools to an LLM client.
- Build, inspect, and test a simple MCP tool server.
- Choose a capstone idea by starting from viable data and constraining the MVP.

## End-to-end improvements reported by the instructor

### Context-window failure

The aggregator initially failed silently for patients with many notes because GPT-4’s context window was too small for the assembled data. Switching to GPT-4o resolved that specific issue. This should be taught as a diagnostic pattern: inspect input size and model limits before assuming a prompt or code bug.

### Metadata filter extraction

The instructor adds a lightweight LLM call to extract RAG metadata filters from a user query, then passes those filters to the vector search. This enables queries involving attributes such as names, demographics, or other metadata to constrain semantic retrieval.

### Few-shot prompting

Few-shot prompts are presented as a practical alternative to endlessly expanding unstructured instructions or fine-tuning. The class stores examples programmatically as objects/arrays and serializes them into system-prompt context.

Examples cover expected outputs for:

- SQL-only questions.
- RAG-only questions.
- Hybrid SQL + RAG questions.
- Scheduling requests.
- Clarification-needed requests.
- Metadata extraction, e.g., race/gender/name-oriented filters.

Course principle: when a real edge case fails, add a concise example of the desired input/output behavior. If the few-shot list grows very large, revisit the architecture or task definition; it may no longer be an edge-case problem.

### Dynamic SQL schema inspection

Rather than copy a schema file into prompts, the instructor later introspects database schema/relationships and passes the current schema information to the SQL agent. The intended benefit is that migrations and schema changes are reflected automatically.

### Final MVP demo behavior

The instructor demonstrates a working flow that retrieves trends for older male patients, identifies an older patient, proposes a future appointment, requires confirmation, calls Cal.com, and then displays a scheduled appointment. It is explicitly presented as an MVP that will need continued iteration as users expose failures.

## Why agent work felt difficult to learners

Learners report that prompt design and end-to-end behavior were harder than expected. Common symptoms:

- The selector routes a first question one way, then a follow-up repeats an answer or becomes nonsensical.
- General medical questions do not fit the retrieved clinical corpus cleanly.
- A front-end payload was not updated after a backend/API change.
- One component can work while another silently receives missing/incorrect data.

The instructor’s framing to retain: data pipelines are hard, but agent behavior adds continuous edge cases. This is product engineering: observe real usage, identify the failure point, and iterate deliberately.

## MCP and tool calling

### Concepts taught

- MCP means Model Context Protocol.
- MCP is described as an RPC-like protocol for LLM clients: a server advertises tools; a client/model discovers them, chooses one, calls it with arguments, receives a result, and can turn that result into a user-facing answer.
- An MCP tool needs a name, description, input schema/parameters, and an implementation/response.
- MCP can expose first-party app functionality or third-party integrations to clients such as Claude Desktop.
- It is useful to distinguish tool implementation from the LLM’s presentation layer: the server returns data; the client model can format/respond using that data.

The class connects course retrieval/scheduling functions to an MCP server and asks learners to add a tiny additional tool (for example, a calculator/BMI tool or scheduling helper) to internalize tool registration.

### Inspector and Claude Desktop integration

The MCP Inspector is introduced as a Swagger-like UI for MCP. It can:

- Connect to a local MCP server.
- List registered tools.
- Invoke a tool with arguments.
- Show arguments, responses, errors, and history.
- Verify a tool before connecting it to Claude Desktop.

For Claude Desktop, the class configures a local server path, command/arguments, and required environment variables in the desktop configuration, then restarts Claude so it reloads the configuration.

### MCP environment/debugging problems observed

- The live inspector path/transport used the wrong setup initially; switching to STDIO was necessary.
- Learners saw native-binding/NPM errors, TypeScript-file execution issues, missing packages, and TS-node/TSX configuration problems.
- The server had TypeScript compilation issues, including treating an object result as if it had a `length` property.
- Required environment variables did not always reach the inspector/Claude config.
- Imports required `.js` extensions in the TypeScript/MCP setup.
- Claude Desktop required quit/reopen cycles after configuration changes.
- A 404 retrieval error was eventually traced to an instructor-specific Pinecone index name (`medical-notes-parity`) left in code instead of the learner’s actual index.
- Once corrected, a learner successfully queried clinical notes from Claude through the local MCP tool.

### Curriculum improvements

- Do not make the first MCP exposure a live environment-debugging session. Ship a known-good starter branch, lock Node/package-manager versions, include one tested command per platform, and provide a troubleshooting matrix.
- Teach the inspector first with a zero-dependency “hello” tool, then add retrieval, then add Claude Desktop integration. This isolates tool-registration failures from database/key/client-config failures.
- Use environment validation and print an explicit redacted configuration summary at MCP startup.
- Keep per-learner index names in `.env`; prohibit hard-coded instructor resource names.
- Include security guidance: MCP tools can expose powerful capabilities, so descriptions, argument validation, least privilege, confirmation, and logging matter. The transcript calls MCP “notoriously unsafe”; turn that concern into concrete secure-tool design criteria.

## Capstone transition

The instructor tells learners that the remaining course emphasis is independent capstone work. The immediate task is not to build a polished app; it is to select a doable data source and write a plan.

### Capstone guidance

- Start with data, not interface ideas. Identify data that is interesting, legally/organizationally usable, and large enough to support retrieval—ideally at least a few hundred pieces.
- Use personal, public, or approved proprietary data only. If work data cannot be shown, a screen recording or sanitized demonstration may be appropriate, subject to employer permission.
- Build the minimally usable product, not a full platform. If the instinct is to use 20 sources, begin with two.
- A capstone should be buildable in roughly one to two weeks, then extensible afterward.
- Submit a short plan/document for instructor feedback focused on scope and shortcuts to a working result.

### Data-source/tools discussed

- Existing internal or personal data, when permitted.
- Public web sources through Firecrawl (paid/free-tier structured scraping) or Crawl4AI (open-source, developer-oriented, LLM-friendly markdown extraction).
- YouTube/video transcript ingestion using `yt-dlp`.
- Pinecone as the familiar default vector store.
- Qdrant as an alternative when complex metadata filtering is central; its visualization capability can help inspect clusters/vectors.

### Capstone examples discussed

- A wind-band repertoire assistant based on a wiki of composers, pieces, instrumentation, length, and program constraints. The instructor identifies data acquisition as the main challenge.
- A journaling/reflection interface with AI features.
- A work-related assistant spanning multiple data stores, pending organizational permission.
- A YouTube-creator transcript assistant that ingests transcripts and lets users ask what creators have said about a topic.
- A real-estate/news/source-comparison retrieval product built from scraped public pages.

### Important correction for course materials

The live advice included informal suggestions about scraping and “asking forgiveness later” for work projects. Replace that with explicit boundaries: learners must comply with site terms, applicable law, employer policy, privacy obligations, and permission requirements. The capstone should demonstrate the technical pattern without encouraging unauthorized data use.

---

# Cross-session curriculum changes to implement

## 1. Make the initial environment deterministic

- Publish supported Node/NPM versions and a one-command preflight checker.
- Give every learner a setup checklist with expected outputs and a known-good `.env.example` containing placeholders only.
- Verify repository branch, package installation, Prisma generation, database connection, OpenAI embedding call, Pinecone access, and index name before the live build.
- Provide per-learner/service credentials securely; never put secrets in recorded screenshare or public chat.

## 2. Separate concepts from fragile live implementation

- Teach the architecture live, but provide tested working files for Prisma queries, vector ingestion, SQL agent, calendar adapter, tracing wrapper, and MCP setup.
- Use incremental checkpoints: static data → direct API call → retrieval → aggregation → routing → scheduling → tracing → MCP.
- At every checkpoint, give expected input/output and a clear recovery branch.

## 3. Add explicit validation and evaluation loops

- For ingestion: record count, sample metadata, duplicate-ID behavior, batching/retry status, and resumability.
- For chunking: boundary audit, chunk-size distribution, overlap examples, and outlier detection.
- For retrieval: a small golden-question set with expected relevant documents and task categories.
- For agents: trace review, structured-plan inspection, schema validation, and a regression list of failed edge cases converted into few-shot examples or tests.
- For scheduling: direct API integration test before LLM routing; confirmation UI required.

## 4. Teach system boundaries clearly

| Concern              | Course default             | Production lesson                                                |
| -------------------- | -------------------------- | ---------------------------------------------------------------- |
| Structured facts     | Postgres / Prisma          | Exact lookups, counts, and attributes belong here.               |
| Semantic note search | Pinecone vectors           | Use for meaning-based retrieval; inspect relevance.              |
| Metadata             | Pinecone record metadata   | Use for hard filters; validate types/names.                      |
| Summarization        | Aggregator LLM             | Give only retrieved data; guard against invention.               |
| Routing              | Structured selector output | JSON/schema, never parse prose.                                  |
| High-impact action   | Human-confirmed scheduler  | Keep a person in the loop.                                       |
| Observability        | LangSmith                  | Trace behavior and costs before prompt changes.                  |
| Tool exposure        | MCP                        | Validate inputs, least privilege, logging, secure configuration. |

## 5. Tighten safety/compliance language

- State throughout that the course data is synthetic.
- Add a dedicated “real data” checklist for LLM, vector, tracing, scheduling, scraping, and MCP integrations.
- Distinguish data-retention controls from training opt-out; require learners to consult provider documentation and organizational policy rather than rely on generic assurances.
- Treat PHI/PII removal, authorization, auditability, and service contracts as product requirements, not afterthoughts.

## 6. Preserve the course’s strongest pedagogical moves

- Keep the medical-office scenario because it naturally demonstrates SQL + RAG + retrieval quality + human confirmation.
- Keep the manual SQL-to-LLM summary demo before automation; it makes the value proposition concrete.
- Keep the Bible assignment because it forces learners to reason about chunking/metadata in a different domain.
- Keep public explanation videos and peer review, but provide a clear rubric: source/data choice, chunking/retrieval rationale, validation evidence, limitations, and next improvement.
- Keep the “MVP first, iterate from evidence” message. The course’s most valuable recurring lesson is that reliable AI systems are built through bounded workflows, observability, evaluation, and repeated refinement.
