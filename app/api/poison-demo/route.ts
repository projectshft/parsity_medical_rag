import { NextResponse } from 'next/server';
import { z } from 'zod';
import { aggregate } from '@/lib/agents/aggregator';
import fixture from '@/data/security/poisoned/banana-note.json';

const DemoRequestSchema = z.object({
	query: z.string().trim().min(1).max(2000),
	mode: z.enum(['clean', 'poisoned']),
});

export async function POST(request: Request) {
	try {
		const { query, mode } = DemoRequestSchema.parse(await request.json());
		const documents = mode === 'clean'
			? [fixture.cleanNote]
			: [fixture.cleanNote, fixture.poisonedNote];
		const contextSent = documents.join('\n\n');
		// Fresh history isolates comparisons; the payload enters only as retrieved data.
		const message = await aggregate(query, [], contextSent, 'gpt-4o-mini');
		return NextResponse.json({
			message,
			poisonDemo: {
				mode,
				retrieved: documents.join('\n\n'),
				contextSent,
				markerPresent: message.includes(fixture.marker),
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError || error instanceof SyntaxError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 },
		);
	}
}
