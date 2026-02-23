import { pgTable, text, timestamp, index, serial } from 'drizzle-orm/pg-core';

export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    initialContent: text('initial_content'),
    ownerId: text('owner_id').notNull(),
    roomId: text('room_id'),
    organizationId: text('organization_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      ownerIdIdx: index('owner_id_idx').on(table.ownerId),
      organizationIdIdx: index('organization_id_idx').on(table.organizationId),
      titleIdx: index('title_idx').on(table.title),
    };
  }
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export const documentSnapshots = pgTable(
  'document_snapshots',
  {
    id: serial('id').primaryKey(),
    documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(), // Clean ProseMirror JSON (no suggestion marks)
    createdBy: text('created_by').notNull(), // userId who triggered the snapshot
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      documentIdIdx: index('snapshot_document_id_idx').on(table.documentId),
      createdAtIdx: index('snapshot_created_at_idx').on(table.createdAt),
    };
  }
);

export type DocumentSnapshot = typeof documentSnapshots.$inferSelect;
export type NewDocumentSnapshot = typeof documentSnapshots.$inferInsert;
