# AI Engineering Certificate Program

> **Reference copy.** Cleaned-up, reformatted version of the *Form B — Program Proposal for New Certificate Program* (May 2026) for the AI Engineering Certificate that this repository's curriculum supports. This is the governance/accreditation document, kept here for reference. OCR artifacts in the source (e.g. "deci0", "Missednnot", a merged salary line) have been corrected.

---

## 1. Title
AI Engineering

## 2. Type of Certificate to be Awarded
Certificate of Participation

## 3. Program Overview
The AI Engineering Certificate Program prepares working software engineers to design, build, and deploy production-grade AI applications. The curriculum centers on Retrieval-Augmented Generation (RAG), agentic systems, and the engineering practices required to operate these systems reliably in production environments. Coursework is organized around a single end-to-end TypeScript and Next.js codebase that participants extend across the program, culminating in an individual capstone project.

## 4. Course Objectives
Instruction emphasizes engineering fundamentals over framework familiarity; participants implement core mechanics such as vector similarity, chunking, retrieval, reranking, structured outputs, and evaluation before adopting higher-level abstractions.

Upon completion of this program, participants will be able to:

- Explain the architecture and tradeoffs of retrieval-augmented generation systems and articulate when RAG, fine-tuning, or prompting is the appropriate technique.
- Implement vector embeddings, similarity search, and hybrid (sparse plus dense) retrieval pipelines using industry-standard tooling.
- Design and build agentic systems that route between specialized capabilities using structured outputs and validated schemas.
- Apply software engineering practices — testing, observability, and graceful degradation — to non-deterministic AI systems.
- Evaluate AI systems using both deterministic tests and Large Language Model (LLM)-as-judge methodologies.
- Communicate technical decisions, tradeoffs, and system designs in professional contexts.
- Independently scope, build, and present a production-quality AI application addressing a defined real-world use case.
- Communicate the capabilities, limitations, and appropriate uses of AI systems to colleagues and decision-makers.

## 5. Structure of the Program

### 5.1 Structure of the Program
Consists of 144 contact hours to be delivered in 5 courses, broken into 16 modules, with associated lab and assignment time totaling 14.4 continuing education units (CEUs).

### 5.2 Pedagogical Approach
The program follows a build-first methodology. Each module pairs a conceptual foundation with an implementation exercise in the shared codebase. Reference implementations are maintained on a dedicated curriculum branch; learners work from a parallel branch containing scaffolded starter code with structured TODOs. Four graded assignments and a final capstone provide formal assessment, supplemented by automated test suites for selected modules.

### 5.3 Proposed Curriculum
The program is organized into 16 instructional modules grouped into five thematic courses. Modules build sequentially; later modules assume mastery of earlier material.

**Table 1 — AIE Curriculum** (144 hours required, 14.4 CEUs)

| Course Code | Course Title | Requirements | Hours / CEUs |
|---|---|---|---|
| AIE 101 | Foundations of Retrieval-Augmented Generation — Modules 1–5 | Required | 36 hrs / 3.6 |
| AIE 102 | Agent Architecture and Specialization — Modules 6–9 | Required | 32 hrs / 3.2 |
| AIE 103 | User Interface and Production Operations — Modules 10–12 | Required | 28 hrs / 2.8 |
| AIE 104 | Advanced Techniques and Structured Retrieval — Modules 13–14 | Required | 28 hrs / 2.8 |
| AIE 105 | Capstone and Professional Preparation — Modules 15–16 | Required | 20 hrs / 2.0 |

### 5.4 Curriculum Rationale
The curriculum is constructed to favor durable engineering patterns over instruction in any specific framework or vendor tooling, supporting an expected useful life of multiple years without structural revision. Tools are taught as instances of broader architectural patterns, so that learners are equipped to adapt as the AI landscape evolves. Graduates are prepared to serve as informed practitioners and internal points of expertise within their organizations.

The program curriculum is designed for participants who already possess general programming proficiency and are seeking applied, production-oriented AI engineering skills suitable for immediate workplace application.

### 5.5 Scheduling
Courses will be offered online in a fully asynchronous format and in a hybrid format. Courses will be offered in multiple sessions with participants meeting weekly for consecutive weeks.

### 5.6 Description of Enrollment in the Program
The program is based on a schedule coupled with open enrollment. Participants register for the full 5-course program. The program is cohort-based and no formal application is required, though prospective participants must meet the technical prerequisites described in Section 5.8.

### 5.7 Challenges / Equivalences / Prerequisite Courses / Evaluation of Previous Units / Other
The certificate program comprises 5 courses broken into 16 modules encompassing 14.4 continuing education units (CEUs). Participants are required to take all 5 courses in order to complete the certificate program.

### 5.8 Prerequisites and Technology Stack

**Table 2 — Prerequisites & Technology Stack**

| Prerequisites | Technology Stack |
|---|---|
| Working proficiency in JavaScript or TypeScript; familiarity with Git, command-line tooling, and REST APIs; comfort building and running a Node.js application. | TypeScript, Next.js, Node.js, Pinecone (vector database), OpenAI API, Zod (schema validation), LangSmith (observability). All work is performed in a shared instructional repository with reference and student-exercise branches. |

### 5.9 Attendance Policy
To receive credit for this certificate program, participants are expected to attend each course module for its full duration and complete all five graded assignments. Please note: missed sessions cannot always be made up outside of class. Therefore, approval of absences is not guaranteed.

## 6. Names and Qualifications of the Initiators and/or Academic Units
- **6.1 Initiating College or Department:** College of Continuing Education (CCE), Sacramento State (CSUS.edu)
- **6.2 Primary Coordinator:** Dr. Paulo Pinto, Academic & Professional Programs, CCE
- **6.3 Collaborative Department:** Dr. Alexander Jones, Apprenticeship & Workforce Specialist, Clover Agency, Inc.
- **6.4 Instructor Qualifications:** The instructor will be a professional in the field. (See Instructor(s)' Résumé(s) in Appendix B.) Instructor qualifications include teaching, training or presentation experience; a bachelor's degree or higher is desirable; subject-matter expertise; and professional experience in the field of the application of artificial intelligence.
- **6.5 Coordinating / Advisory Committee:**
  - Alexander Jones, Ed.D., Apprenticeship and Workforce Specialist, Clover Agency, Inc.
  - Paulo Pinto, Ed.D., Academic & Professional Programs, Sacramento State's College of Continuing Education (CCE)
  - Brian Jenney, Engineering Manager / Software Engineer / Full Stack JavaScript Developer — Founder, Parsity (parsity.io)

## 7. Duration of the Program
This is an ongoing program with all five required courses offered each semester, allowing participants to complete the program in 6 to 10 months. This program will continue to be offered as long as it is viable in the market.

## 8. Resources Needed for the Program
- **8.1** The AI Engineering Certificate Program is offered through CCE and is designed to be self-supporting.
- **8.2** Instructors will be drawn from the University, affiliate faculty, and the professional business community. Compensation will be in accordance with University policy for hiring through CCE.
- **8.3** Classes will be held at CCE, online, and/or in regional employer facilities as needed and available. The program fee includes access to a shared instructional repository containing reference implementations and scaffolded exercises, along with API credits sufficient to complete all coursework (OpenAI API, Pinecone vector database, LangSmith observability platform). Learners are expected to have their own laptop capable of running Node.js development tooling; no specialized hardware is required.
- **8.4** Supporting materials, including syllabi, rubrics, codebase access, instructor biographies, and learner outcomes data, are available upon request.

## 9. Expected Number of Students and Their Probable Background
Estimated class size is approximately 20 participants. The program is directed at:

- Working software engineers, developers, and technical professionals with proficiency in JavaScript or TypeScript
- Participants with familiarity with Git, command-line tooling, REST APIs, and comfort building and running a Node.js application
- No prior experience with AI/ML tooling is required; the program assumes general programming proficiency and teaches AI engineering skills from the ground up

## 10. Employment Opportunities
This program meets the needs of individuals interested in developing production AI engineering skills. California positions and salary ranges include:

- AI Engineer — $138,000–$222,000 [^1]
- Machine Learning Engineer — $154,000–$243,000 [^2]
- Applied AI / RAG Engineer — $121,000–$195,000 [^3]
- Generative AI Engineer — 25th–75th percentile, California [^4]
- Senior Software Engineer (AI specialization) — $145,000–$210,000 [^5]
- Staff / Principal AI Engineer (senior ceiling) — $222,000–$275,000+ [^6]

> Note: Sacramento is classified as a Zone 3 AI engineering market by industry recruiters, with salaries tracking 8–10% behind the Bay Area but well above the national average.

[^1]: Glassdoor, AI Engineer in California, 25th–75th percentile (May 2026, 248 reported salaries)
[^2]: Glassdoor, Machine Learning Engineer in California, 25th–75th percentile (2026, 4,354 reported salaries)
[^3]: Glassdoor, AI Engineer in Sacramento, CA, 25th–75th percentile (April 2026)
[^4]: ZipRecruiter, Generative AI Engineer in California, 25th–75th percentile (May 2026)
[^5]: MRJ Recruitment, AI Engineering Salary Benchmarks 2026, Zone 3 markets (Sacramento included)
[^6]: Glassdoor, AI Engineer 90th percentile California (2026); Levels.fyi California AI Engineer median $211,000

## 11. Other Pertinent Information
See Appendix A for Course Descriptions and Appendix B for Instructor(s)' Résumé(s).

---

# Appendix A — Course Descriptions

## AIE 101 — Foundations of Retrieval-Augmented Generation
**36 Hours (3.6 CEUs)**

This course establishes the technical foundation for production AI engineering. Learners situate Retrieval-Augmented Generation within the broader landscape of large language model applications, then build the core mechanics from the ground up — vector embeddings, similarity search, vector database operations, document chunking, and a complete ingestion pipeline. By the end of the course, learners have a working RAG ingestion system and can defend the design decisions behind it.

- **Module 1 — Introduction to Retrieval-Augmented Generation.** Learners situate RAG within the broader landscape of LLM applications. Topics: the motivation for retrieval augmentation, representative real-world applications across domains, and a high-level architectural overview of a complete RAG system.
- **Module 2 — Vector Mathematics and Embeddings.** A grounded treatment of the mathematics underlying semantic search. Learners study vector representations, implement cosine similarity directly, and explore the geometric properties of embedding spaces through classical word arithmetic exercises.
- **Module 3 — Vector Database Integration with Pinecone.** Practical work with a managed vector database. Learners configure the Pinecone client, provision indexes, and implement upsert and query operations against real embedding data.
- **Module 4 — Document Processing and Chunking Strategies.** Document ingestion, including web scraping fundamentals and the central problem of chunking. Learners examine how chunk size, overlap, and boundary heuristics affect retrieval quality, and implement chunking utilities used throughout the program.
- **Module 5 — Document Upload Pipeline.** Learners construct an end-to-end ingestion pipeline: a script-based document loader, a Next.js API route exposing the pipeline, and query functionality against the populated index.
  - **Assessment — Assignment 1: Document Upload.** Complete the scaffolded ingestion pipeline against a structured set of TODOs.

## AIE 102 — Agent Architecture and Specialization
**32 Hours (3.2 CEUs)**

This course develops learners' ability to design and build production agent systems. Learners study the tradeoffs between fine-tuning and retrieval augmentation, implement routing agents with schema-validated structured outputs, build specialized domain agents, and integrate reranking and hybrid search to improve retrieval quality.

- **Module 6 — Fine-Tuning: Theory and Application.** A comparative treatment of fine-tuning and retrieval augmentation. Learners examine when each approach is appropriate, review fine-tuning workflows, and execute a representative fine-tuning job.
- **Module 7 — Agent Architecture and Structured Outputs.** Design of agent systems in which a router selects among specialized capabilities. Topics: prompting strategies for routing, schema-validated structured outputs using Zod, and graceful degradation patterns (model fallbacks, retry logic, user-facing error messaging).
  - **Assessment — Assignment 2: Selector Agent.** Implement the routing agent with validated structured outputs and accompanying tests.
- **Module 8 — Specialized Agent: LinkedIn Content.** A focused exercise in prompt engineering for a domain-specific agent. Learners implement a LinkedIn content agent and analyze how task framing, constraint specification, and example selection affect output quality.
- **Module 9 — RAG Agent with Hybrid Search and Reranking.** The capstone of the agent unit. Learners implement the program's core RAG agent, integrate a reranking stage, and study hybrid search using both sparse and dense vector representations. A demonstration script makes the underlying retrieval behavior directly observable.
  - **Assessment — Assignment 3: RAG Agent.** Build the production RAG agent, including reranking and hybrid retrieval.

## AIE 103 — User Interface and Production Operations
**28 Hours (2.8 CEUs)**

This course addresses the production engineering practices that distinguish a working AI prototype from a deployable system. Learners build a streaming conversational interface, integrate distributed tracing with LangSmith, and develop testing strategies for non-deterministic systems.

- **Module 10 — Conversational Interface and Streaming.** The Next.js chat interface that fronts the agent system. Topics: streaming response handling, conversation context management, and interaction patterns.
- **Module 11 — Observability with LangSmith.** Observability tailored to non-deterministic AI systems. Learners integrate LangSmith for distributed tracing, debug agent behavior across nested calls, and establish monitoring practices for production.
- **Module 12 — Testing AI Agents.** Strategies for evaluating systems whose outputs are inherently variable. Learners implement deterministic tests for the selector agent and study the LLM-as-judge evaluation pattern against traditional assertion-based testing.

## AIE 104 — Advanced Techniques and Structured Retrieval
**28 Hours (2.8 CEUs)**

This course extends the program's agent foundations to handle tools and structured data sources. Learners study the tool-calling contract, design well-bounded tool interfaces, and reason about the boundary between deterministic code and model-mediated behavior — then address retrieval against structured data where vector search is inappropriate.

- **Module 13 — Tool Calling and Agent Capabilities.** Foundational work on tool-calling abstractions. Learners examine the tool-calling contract, design tools that expose well-bounded capabilities, and reason about the boundary between deterministic code and model-mediated behavior.
- **Module 14 — Structured Data Retrieval: SQL Agents.** Retrieval against structured data, where vector search is inappropriate. Topics: text-to-SQL patterns, query validation, and the safety considerations specific to model-generated database queries. Implementation occurs in a dedicated companion repository.
  - **Assessment — Assignment 4: SQL Agent.** Implement a text-to-SQL agent against a provided dataset.

## AIE 105 — Capstone and Professional Preparation
**20 Hours (2.0 CEUs)**

In this capstone course, learners scope, design, build, and present an original RAG application addressing a real-world use case. The course includes a structured ideation framework, regular instructor checkpoints, and final submission requirements covering working code, documentation, and a demonstration. A closing module prepares learners for professional contexts.

- **Module 15 — Capstone Project.** Learners scope, design, and build an original RAG application addressing a real-world use case. Includes a structured ideation framework, regular instructor checkpoints, and final submission requirements (working code, documentation, presentation).
  - **Assessment — Assignment 5: Capstone.** A complete, original RAG application with documentation and a presented demonstration.
- **Module 16 — Professional Preparation and Interview Readiness.** Prepares learners to discuss their work in professional contexts: constructing a signature project narrative, developing and defending technical opinions on engineering tradeoffs, answering RAG system-design questions, and live mock practice with instructor feedback.

---

## Deliverables (program-wide)

| Assignment | Aligned Module | Type |
|---|---|---|
| Document Upload Pipeline | Module 5 | Formative |
| Selector Agent with Structured Outputs | Module 7 | Formative |
| RAG Agent with Reranking | Module 9 | Formative |
| Text-to-SQL Agent | Module 14 | Formative |
| Capstone Project | Module 15 | Summative |

**Course Format (all courses):** Delivered through lectures, guest speakers, class exercises, individual activities, small-group work, and readings.

**Recommended Reading (all courses):** Anthropic and OpenAI API documentation; plus per-course: Pinecone docs & OpenAI Embeddings reference (101); OpenAI fine-tuning guide, Anthropic tool-use docs, Zod docs (102); LangSmith docs & Next.js Streaming/Server Components docs (103). Textbook: N/A.
