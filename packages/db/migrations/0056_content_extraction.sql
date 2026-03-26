CREATE TYPE "public"."ContentExtractionStatus" AS ENUM('PENDING', 'EXTRACTING', 'COMPLETE', 'FAILED', 'UNSUPPORTED');--> statement-breakpoint
ALTER TABLE "manuscript_versions" ADD COLUMN "content" jsonb;--> statement-breakpoint
ALTER TABLE "manuscript_versions" ADD COLUMN "content_format" varchar(50);--> statement-breakpoint
ALTER TABLE "manuscript_versions" ADD COLUMN "content_extraction_status" "ContentExtractionStatus" DEFAULT 'PENDING' NOT NULL;
