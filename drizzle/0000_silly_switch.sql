CREATE TABLE "document_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"initial_content" text,
	"owner_id" text NOT NULL,
	"room_id" text,
	"organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshot_document_id_idx" ON "document_snapshots" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "snapshot_created_at_idx" ON "document_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "owner_id_idx" ON "documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "organization_id_idx" ON "documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "title_idx" ON "documents" USING btree ("title");