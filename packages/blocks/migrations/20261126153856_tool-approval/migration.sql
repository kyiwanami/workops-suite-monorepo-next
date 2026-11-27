CREATE TABLE "ToolApproval" (
	"toolUseId" text PRIMARY KEY,
	"conversationId" uuid NOT NULL,
	"toolName" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL,
	CONSTRAINT "ToolApproval_status" CHECK ("status" in ('approved', 'denied', 'succeeded', 'failed'))
);
