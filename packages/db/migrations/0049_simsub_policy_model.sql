-- SimSubPolicyType enum (for reference/validation; actual column is JSONB)
CREATE TYPE "SimSubPolicyType" AS ENUM ('prohibited','allowed','allowed_notify','allowed_withdraw');
--> statement-breakpoint

-- Migrate simSubProhibited boolean to sim_sub_policy JSONB
ALTER TABLE submission_periods ADD COLUMN sim_sub_policy jsonb;
UPDATE submission_periods SET sim_sub_policy = CASE
  WHEN sim_sub_prohibited = true THEN '{"type":"prohibited"}'::jsonb
  ELSE '{"type":"allowed"}'::jsonb
END;
ALTER TABLE submission_periods ALTER COLUMN sim_sub_policy SET NOT NULL;
ALTER TABLE submission_periods ALTER COLUMN sim_sub_policy SET DEFAULT '{"type":"allowed"}'::jsonb;
--> statement-breakpoint

-- Drop old boolean column
ALTER TABLE submission_periods DROP COLUMN sim_sub_prohibited;
--> statement-breakpoint

-- Add policy requirement to submissions
ALTER TABLE submissions ADD COLUMN sim_sub_policy_requirement jsonb;
--> statement-breakpoint

-- Genre CHECK constraint on manuscripts
ALTER TABLE manuscripts ADD CONSTRAINT manuscripts_genre_primary_check
  CHECK (genre IS NULL OR genre->>'primary' IN (
    'poetry','fiction','creative_nonfiction','nonfiction',
    'drama','translation','visual_art','comics','audio','other'
  ));
