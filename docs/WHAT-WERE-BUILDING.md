# What we're building, and why

You've just joined a medical clinic as an engineer. The company already has years of data in a Postgres database — 200 patients, their diagnoses, medications, lab results, and about 21,000 free-text clinical notes written by doctors at every visit. You didn't build any of it. It's just there, the way real company data always is.

Here's the problem: only half of that data is actually *reachable*. The structured facts — diagnoses, prescriptions, lab values — got their own columns, so SQL can answer "how many patients have diabetes?" in milliseconds. But the **story** of each visit — why the patient came in, symptoms in their own words, what the doctor noticed — was only ever written down in the notes. There is no "short of breath" column. Search the notes for it and you get zero rows, because the doctor wrote *"dyspnea on exertion."* Same fact, zero shared words. The database matches **letters**; the question was about **meaning**.

That's what we're building over the next six weeks: an AI assistant that can finally reach that other half — and then *act* on it. We'll make the notes searchable by meaning (a vector store), teach an LLM to write database queries from plain English, and wire both into one system that gets each question to the right engine. Then we'll hand it tools and let it decide for itself — and measure whether that was actually an improvement, because by then you'll have the evals to tell.

Finally we let it do real work: **booking appointments**, **flagging patients for follow-up**, **retracting a note that shouldn't be there** — every one of them reversible, recorded, and waiting on a human to click confirm, because an AI that acts on the real world needs a human in the loop and an undo button.

By the end, a clinic worker can ask *"which of my patients are struggling to breathe?"* and get a real answer grounded in the actual records — then say *"book a follow-up for her Tuesday"* and watch the appointment land. Built by you, and you'll understand every layer, because you'll have built every layer.

One thing that makes this different from a tutorial: **you'll be able to prove it works.** From week 2 you keep a golden set of questions with known-correct answers, and every change after that — reranking, tool calling, a new prompt — gets judged against it. Anyone can say they built a RAG app. Being able to say what its recall was before and after you changed something is the part that gets you hired.

(Every patient is synthetic — statistically realistic, zero real people — so we get to practise on medical data that's safe to break. And the database is yours, so breaking it is free.)
