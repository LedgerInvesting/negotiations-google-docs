import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, documentSnapshots } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// POST - Create a new document snapshot (clean version before suggestions)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;

    // Verify document exists
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    // Check if the latest snapshot has the same content (avoid duplicates)
    const [latestSnapshot] = await db
      .select()
      .from(documentSnapshots)
      .where(eq(documentSnapshots.documentId, documentId))
      .orderBy(desc(documentSnapshots.createdAt))
      .limit(1);

    const contentString = typeof content === "string" ? content : JSON.stringify(content);

    if (latestSnapshot && latestSnapshot.content === contentString) {
      console.log("[SNAPSHOT] Skipping duplicate snapshot for document:", documentId);
      return NextResponse.json({ 
        snapshot: latestSnapshot,
        skipped: true,
      });
    }

    // Save the snapshot
    const [snapshot] = await db
      .insert(documentSnapshots)
      .values({
        documentId,
        content: contentString,
        createdBy: userId,
      })
      .returning();

    console.log("[SNAPSHOT] Created snapshot", snapshot.id, "for document:", documentId);

    return NextResponse.json({ snapshot, skipped: false }, { status: 201 });
  } catch (error) {
    console.error("[SNAPSHOT_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// GET - List snapshots for a document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;

    // Verify document exists
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    const snapshots = await db
      .select()
      .from(documentSnapshots)
      .where(eq(documentSnapshots.documentId, documentId))
      .orderBy(desc(documentSnapshots.createdAt))
      .limit(limit);

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("[SNAPSHOT_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
