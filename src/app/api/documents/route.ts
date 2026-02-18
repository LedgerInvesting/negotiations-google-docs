import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { eq, and, ilike, desc, gt } from 'drizzle-orm';
import { broadcastDocumentUpdate } from '@/lib/websocket-events';

// GET - List documents with pagination and search
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '5');
    const organizationId = (sessionClaims?.org_id as string) || undefined;

    // Build where conditions
    const conditions = [];
    
    if (organizationId) {
      conditions.push(eq(documents.organizationId, organizationId));
    } else {
      conditions.push(eq(documents.ownerId, userId));
    }

    if (search) {
      conditions.push(ilike(documents.title, `%${search}%`));
    }

    if (cursor) {
      conditions.push(gt(documents.id, cursor));
    }

    // Fetch documents with cursor pagination
    const fetchedDocs = await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt))
      .limit(limit + 1);

    // Check if there are more documents
    const hasMore = fetchedDocs.length > limit;
    const resultDocs = hasMore ? fetchedDocs.slice(0, limit) : fetchedDocs;
    const nextCursor = hasMore ? resultDocs[resultDocs.length - 1].id : null;

    return NextResponse.json({
      documents: resultDocs,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('[DOCUMENTS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

// POST - Create new document
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, initialContent } = body;

    const organizationId = (sessionClaims?.org_id as string) || undefined;

    const [document] = await db
      .insert(documents)
      .values({
        title: title || 'Untitled document',
        initialContent,
        ownerId: userId,
        organizationId,
      })
      .returning();

    // Broadcast document creation
    broadcastDocumentUpdate('created', document);

    return NextResponse.json(document);
  } catch (error) {
    console.error('[DOCUMENTS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
