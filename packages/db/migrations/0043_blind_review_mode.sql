CREATE TYPE "BlindReviewMode" AS ENUM ('none', 'single_blind', 'double_blind');
--> statement-breakpoint
ALTER TABLE "submission_periods" ADD COLUMN "blind_review_mode" "BlindReviewMode" DEFAULT 'none' NOT NULL;
