-- 0036_writer_workspace.sql
-- Track 8: Writer workspace tables — journal directory, external submissions,
-- correspondence, writer profiles, and genre column on manuscripts.

-- 1. New enum types
CREATE TYPE "PrimaryGenre" AS ENUM (
  'poetry', 'fiction', 'creative_nonfiction', 'nonfiction', 'drama',
  'translation', 'visual_art', 'comics', 'audio', 'other'
);
--> statement-breakpoint

CREATE TYPE "CsrStatus" AS ENUM (
  'draft', 'sent', 'in_review', 'hold', 'accepted', 'rejected',
  'withdrawn', 'no_response', 'revise', 'unknown'
);
--> statement-breakpoint

CREATE TYPE "CorrespondenceDirection" AS ENUM ('inbound', 'outbound');
--> statement-breakpoint

CREATE TYPE "CorrespondenceChannel" AS ENUM ('email', 'portal', 'in_app', 'other');
--> statement-breakpoint

-- 2. Add genre column to manuscripts
ALTER TABLE "manuscripts" ADD COLUMN "genre" jsonb;
--> statement-breakpoint

-- 3. journal_directory — global shared, system-only writes
CREATE TABLE "journal_directory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(500) NOT NULL,
  "normalized_name" varchar(500) NOT NULL,
  "external_url" varchar(1000),
  "colophony_domain" varchar(512),
  "colophony_org_id" uuid,
  "directory_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "journal_directory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_directory" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "journal_directory"
  ADD CONSTRAINT "journal_directory_normalized_name_unique"
  UNIQUE ("normalized_name");
--> statement-breakpoint

CREATE INDEX "journal_directory_colophony_domain_idx"
  ON "journal_directory" USING btree ("colophony_domain");
--> statement-breakpoint

CREATE POLICY "journal_directory_read" ON "journal_directory"
  AS PERMISSIVE FOR SELECT TO public
  USING (current_user_id() IS NOT NULL);
--> statement-breakpoint

-- SELECT only — writes via superuser pool
GRANT SELECT ON "journal_directory" TO app_user;
--> statement-breakpoint

CREATE TRIGGER "trg_journal_directory_set_updated_at"
  BEFORE UPDATE ON "journal_directory"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- 4. external_submissions — user-scoped
CREATE TABLE "external_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "manuscript_id" uuid,
  "journal_directory_id" uuid,
  "journal_name" varchar(500) NOT NULL,
  "status" "CsrStatus" DEFAULT 'sent' NOT NULL,
  "sent_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "method" varchar(100),
  "notes" text,
  "imported_from" varchar(100),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "external_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_submissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "external_submissions"
  ADD CONSTRAINT "external_submissions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "external_submissions"
  ADD CONSTRAINT "external_submissions_manuscript_id_manuscripts_id_fk"
  FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE "external_submissions"
  ADD CONSTRAINT "external_submissions_journal_directory_id_fk"
  FOREIGN KEY ("journal_directory_id") REFERENCES "public"."journal_directory"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX "external_submissions_user_id_idx"
  ON "external_submissions" USING btree ("user_id");
CREATE INDEX "external_submissions_user_status_idx"
  ON "external_submissions" USING btree ("user_id", "status");
CREATE INDEX "external_submissions_manuscript_id_idx"
  ON "external_submissions" USING btree ("manuscript_id");
CREATE INDEX "external_submissions_journal_directory_id_idx"
  ON "external_submissions" USING btree ("journal_directory_id");
--> statement-breakpoint

CREATE POLICY "external_submissions_owner" ON "external_submissions"
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = current_user_id());
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "external_submissions" TO app_user;
--> statement-breakpoint

CREATE TRIGGER "trg_external_submissions_set_updated_at"
  BEFORE UPDATE ON "external_submissions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- 5. correspondence — user-scoped with org read for editors
CREATE TABLE "correspondence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "submission_id" uuid,
  "external_submission_id" uuid,
  "direction" "CorrespondenceDirection" NOT NULL,
  "channel" "CorrespondenceChannel" DEFAULT 'email' NOT NULL,
  "sent_at" timestamp with time zone NOT NULL,
  "subject" varchar(500),
  "body" text NOT NULL,
  "sender_name" varchar(255),
  "sender_email" varchar(255),
  "is_personalized" boolean DEFAULT false NOT NULL,
  "source" varchar(50) DEFAULT 'manual' NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "correspondence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "correspondence" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "correspondence"
  ADD CONSTRAINT "correspondence_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "correspondence"
  ADD CONSTRAINT "correspondence_submission_id_submissions_id_fk"
  FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "correspondence"
  ADD CONSTRAINT "correspondence_external_submission_id_fk"
  FOREIGN KEY ("external_submission_id") REFERENCES "public"."external_submissions"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- XOR constraint: exactly one of submission_id or external_submission_id must be non-null
ALTER TABLE "correspondence"
  ADD CONSTRAINT "correspondence_submission_xor"
  CHECK (
    (submission_id IS NOT NULL AND external_submission_id IS NULL)
    OR
    (submission_id IS NULL AND external_submission_id IS NOT NULL)
  );
--> statement-breakpoint

CREATE INDEX "correspondence_user_id_idx"
  ON "correspondence" USING btree ("user_id");
CREATE INDEX "correspondence_submission_id_idx"
  ON "correspondence" USING btree ("submission_id");
CREATE INDEX "correspondence_external_submission_id_idx"
  ON "correspondence" USING btree ("external_submission_id");
--> statement-breakpoint

-- Owner CRUD
CREATE POLICY "correspondence_owner" ON "correspondence"
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = current_user_id());
--> statement-breakpoint

-- Org editors can read correspondence on their org's submissions
CREATE POLICY "correspondence_org_read" ON "correspondence"
  AS PERMISSIVE FOR SELECT TO public
  USING (submission_id IN (
    SELECT id FROM submissions
    WHERE organization_id = current_org_id()
  ));
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "correspondence" TO app_user;
--> statement-breakpoint

CREATE TRIGGER "trg_correspondence_set_updated_at"
  BEFORE UPDATE ON "correspondence"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- 6. writer_profiles — user-scoped
CREATE TABLE "writer_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "platform" varchar(100) NOT NULL,
  "external_id" varchar(500),
  "profile_url" varchar(1000),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "writer_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "writer_profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "writer_profiles"
  ADD CONSTRAINT "writer_profiles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "writer_profiles"
  ADD CONSTRAINT "writer_profiles_user_platform_unique"
  UNIQUE ("user_id", "platform");
--> statement-breakpoint

CREATE INDEX "writer_profiles_user_id_idx"
  ON "writer_profiles" USING btree ("user_id");
CREATE INDEX "writer_profiles_platform_external_id_idx"
  ON "writer_profiles" USING btree ("platform", "external_id");
--> statement-breakpoint

CREATE POLICY "writer_profiles_owner" ON "writer_profiles"
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = current_user_id());
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "writer_profiles" TO app_user;
--> statement-breakpoint

CREATE TRIGGER "trg_writer_profiles_set_updated_at"
  BEFORE UPDATE ON "writer_profiles"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
