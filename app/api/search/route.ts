import { searchClinicalNotes } from '@/lib/vector-search';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
	const { query, patientIds, topK } = await request.json();

	const results = await searchClinicalNotes(query, { patientIds, topK });

	return NextResponse.json(results);
}
