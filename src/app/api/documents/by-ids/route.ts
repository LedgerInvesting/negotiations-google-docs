import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { inArray } from 'drizzle-orm';

// POST - Get documents by IDs
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const foundDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
      })
      .from(documents)
      .where(inArray(documents.id, ids));

    // Map results, including "[Removed]" for missing documents
    const results = ids.map((id: string) => {
      const doc = foundDocs.find((d) => d.id === id);
      return doc ? { id: doc.id, name: doc.title } : { id, name: '[Removed]' };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('[DOCUMENTS_BY_IDS]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
