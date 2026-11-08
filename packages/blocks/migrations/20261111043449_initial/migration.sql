CREATE TABLE "App" (
	"appId" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text,
	"urlDomain" text NOT NULL,
	"iconName" text,
	"color" text,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"departmentId" uuid NOT NULL,
	"name" text NOT NULL,
	"assetTypeId" uuid NOT NULL,
	"status" text NOT NULL,
	"assigneeSub" text,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL,
	CONSTRAINT "Asset_status" CHECK ("status" in ('inStock', 'lent', 'inRepair', 'disposed'))
);
--> statement-breakpoint
CREATE TABLE "AssetType" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"sortOrder" integer NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AuditLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"requestId" uuid NOT NULL,
	"action" text NOT NULL,
	"previousStatus" text,
	"newStatus" text,
	"reason" text,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	CONSTRAINT "AuditLog_previousStatus" CHECK ("previousStatus" in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')),
	CONSTRAINT "AuditLog_newStatus" CHECK ("newStatus" in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "Department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sortOrder" integer NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Page" (
	"appId" text,
	"pageId" text,
	"name" text NOT NULL,
	"description" text,
	"relativePath" text,
	"iconName" text,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL,
	CONSTRAINT "Page_pkey" PRIMARY KEY("appId","pageId")
);
--> statement-breakpoint
CREATE TABLE "Request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"departmentId" uuid NOT NULL,
	"requestTypeId" uuid NOT NULL,
	"requesterSub" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" integer,
	"status" text NOT NULL,
	"submittedAt" timestamp with time zone,
	"approvedAt" timestamp with time zone,
	"approverSub" text,
	"rejectedAt" timestamp with time zone,
	"rejectionReason" text,
	"withdrawnAt" timestamp with time zone,
	"returnedAt" timestamp with time zone,
	"returnReason" text,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL,
	CONSTRAINT "Request_status" CHECK ("status" in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "RequestType" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserMembership" (
	"sub" text PRIMARY KEY,
	"departmentId" uuid NOT NULL,
	"role" text NOT NULL,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"createdBy" text NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"updatedBy" text NOT NULL,
	CONSTRAINT "UserMembership_role" CHECK ("role" in ('viewer', 'editor', 'manager'))
);
--> statement-breakpoint
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_departmentId_Department_id_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assetTypeId_AssetType_id_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "AssetType"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "Page" ADD CONSTRAINT "Page_appId_App_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("appId") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "Request" ADD CONSTRAINT "Request_departmentId_Department_id_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "Request" ADD CONSTRAINT "Request_requestTypeId_RequestType_id_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "RequestType"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_departmentId_Department_id_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT;