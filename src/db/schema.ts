import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

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
