import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { broadcastDocumentUpdate } from "@/lib/websocket-events";

// GET - Get single document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, (await params).documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("[DOCUMENT_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// PATCH - Update document
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = (sessionClaims?.org_id as string) || undefined;

    // Check if user has permission to edit
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, (await params).documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const isOwner = document.ownerId === userId;
    const isOrganizationMember = !!(
      document.organizationId && document.organizationId === organizationId
    );

    if (!isOwner && !isOrganizationMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { title } = body;

    const [updatedDocument] = await db
      .update(documents)
      .set({ title, updatedAt: new Date() })
      .where(eq(documents.id, (await params).documentId))
      .returning();

    // Broadcast document update
    broadcastDocumentUpdate("updated", updatedDocument);

    return NextResponse.json(updatedDocument);
  } catch (error) {
    console.error("[DOCUMENT_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// DELETE - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = (sessionClaims?.org_id as string) || undefined;

    // Check if user has permission to delete
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, (await params).documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const isOwner = document.ownerId === userId;
    const isOrganizationMember = !!(
      document.organizationId && document.organizationId === organizationId
    );

    if (!isOwner && !isOrganizationMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.delete(documents).where(eq(documents.id, (await params).documentId));

    // Broadcast document deletion
    broadcastDocumentUpdate("deleted", { id: (await params).documentId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DOCUMENT_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
