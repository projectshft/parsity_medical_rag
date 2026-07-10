# Challenge: Deployment & Hosted Inference

Ship the medical RAG app to a runnable hosted environment, with model inference
and secrets configured the way a production deployment requires.

> **Capstone track:** Option 6 · **Competency:** C-DEP-1 (Hosted inference & deployment)

## Learning Objectives

- Configure **hosted model inference** access for end users
- Manage environment configuration and secrets across environments (no secrets in code)
- Deploy a Next.js + Prisma app to a hosting provider
- Verify a deployment with a health/smoke check

## Background

The app reads all credentials from environment variables (see `.env.example`):
`DATABASE_URL`, `PINECONE_API_KEY` / `PINECONE_INDEX`, `OPENAI_API_KEY`,
optional `COHERE_API_KEY`, `LANGSMITH_*`. Locally these live in `.env`. In a
deployment they must be provided by the host's secret store — never committed.

"Hosted inference" means the deployed app talks to a managed model endpoint
(a hosted API such as OpenAI, or **AWS Bedrock**) rather than anything running on
the developer's laptop.

## Your Task

### 1. Choose a host and deploy

- Pick a host (e.g., Vercel for the Next.js app) and deploy the `main` build.
- Ensure the build step runs `prisma generate` so the client is available at runtime.

### 2. Configure secrets & config per environment

- Move every value from `.env.example` into the host's environment/secret settings.
- Confirm **no secrets are committed** (`.env` stays gitignored).
- Document which variables are required vs. optional (e.g., Cohere/LangSmith optional).

### 3. Hosted inference

- Confirm the deployed app reaches its model provider from the hosted environment.
- (Optional Bedrock track) Document the IAM/role and region configuration needed
  for `AWS Bedrock` inference.

### 4. Verify

- Add or document a **smoke check**: hit the deployed chat route with a known
  query and confirm a non-error streamed response.

## Acceptance Criteria

- [ ] App is deployed and reachable at a URL
- [ ] All required env vars are set via the host's secret store (none in the repo)
- [ ] The deployed app performs a successful model inference call
- [ ] A documented smoke check passes against the live deployment
- [ ] `README` (or a `docs/DEPLOY.md`) lists the required/optional env vars

## Bonus

1. **Rollback/redeploy** — document how to roll back a bad deploy.
2. **Health endpoint** — add `app/api/health` returning DB + index reachability.
3. **Preview environments** — wire per-PR preview deploys.

## Resources

- [Deploying Next.js](https://nextjs.org/docs/app/building-your-application/deploying)
- [Prisma in serverless/edge](https://www.prisma.io/docs/orm/prisma-client/deployment)
- [AWS Bedrock](https://docs.aws.amazon.com/bedrock/)
