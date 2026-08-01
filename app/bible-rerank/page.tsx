'use client';

import { useState } from 'react';

// Reranking demo: cosine top-5 vs reranked top-5 (same 20 candidates), side by
// side. Backed by /api/bible-rerank over the bible-verses namespace.

type Item = {
	score: number;
	cosineRank: number;
	reference: string;
	text: string;
};

function Card({ item, reranked, pos }: { item: Item; reranked?: boolean; pos?: number }) {
	return (
		<div className="mb-3 rounded-lg border border-neutral-700 bg-neutral-800 p-4">
			<div className="mb-1 flex items-baseline justify-between gap-2">
				<span className="font-semibold">{item.reference}</span>
				<span className="font-mono text-sm text-neutral-400">
					{item.score.toFixed(3)}
				</span>
			</div>
			<p className="text-sm text-neutral-200">{item.text}</p>
			{reranked && pos !== undefined && (
				<span
					className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
						item.cosineRank - pos > 3
							? 'bg-green-500/15 text-green-400'
							: item.cosineRank - pos < -3
								? 'bg-red-500/15 text-red-400'
								: 'bg-neutral-500/15 text-neutral-400'
					}`}
				>
					{item.cosineRank - pos > 0
						? `⬆ ${item.cosineRank - pos} (was cosine #${item.cosineRank})`
						: item.cosineRank - pos < 0
							? `⬇ ${pos - item.cosineRank} (was cosine #${item.cosineRank})`
							: `held at #${item.cosineRank}`}
				</span>
			)}
		</div>
	);
}

export default function BibleRerankPage() {
	const [query, setQuery] = useState('who should I forgive?');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<{ cosine: Item[]; reranked: Item[] } | null>(null);

	async function search(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/bible-rerank', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query }),
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || res.statusText);
			setData(json);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="min-h-screen bg-neutral-900 p-8 text-neutral-200">
			<h1 className="text-2xl font-bold">Reranking, side by side</h1>
			<p className="mb-6 text-neutral-400">
				Cosine fetches 20 candidates by similarity · the reranker reads each
				one <em>against the query</em> and reorders · all 20, both orderings
			</p>

			<form onSubmit={search} className="mb-8 flex max-w-2xl gap-3">
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 outline-none focus:border-blue-500"
				/>
				<button
					disabled={loading || !query.trim()}
					className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
				>
					{loading ? 'Searching…' : 'Search'}
				</button>
			</form>

			{loading && (
				<p className="text-neutral-400">
					Embedding the query, searching 31,081 verses, reranking 20…
				</p>
			)}
			{error && <p className="text-red-400">Error: {error}</p>}

			{data && !loading && (
				<div className="grid gap-6 lg:grid-cols-2">
					<section>
						<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
							① Cosine order (top 20)
						</h2>
						{data.cosine.map((item) => (
							<Card key={`c-${item.cosineRank}`} item={item} />
						))}
					</section>
					<section>
						<h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
							② Reranked (same 20)
						</h2>
						{data.reranked.map((item, i) => (
							<Card key={`r-${item.cosineRank}`} item={item} reranked pos={i + 1} />
						))}
					</section>
				</div>
			)}

			<p className="mt-8 text-sm text-neutral-500">
				Watch for: verses promoted from deep in the pool (⬆), and rerank
				scores near zero — that&apos;s the reranker telling you nothing
				actually answers the question.
			</p>
		</main>
	);
}
