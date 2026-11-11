ALTER TABLE "Page" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "Page" ADD CONSTRAINT "Page_role" CHECK ("role" in ('viewer', 'editor', 'manager'));