CREATE TABLE "User" (
	"sub" text PRIMARY KEY,
	"name" text,
	"email" text NOT NULL,
	"enabled" boolean NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL
);
