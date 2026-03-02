ALTER TABLE files ADD COLUMN content_hash varchar(64);
CREATE INDEX files_content_hash_idx ON files (content_hash);
--> statement-breakpoint
ALTER TABLE manuscript_versions ADD COLUMN federation_fingerprint varchar(64);
CREATE INDEX manuscript_versions_federation_fingerprint_idx ON manuscript_versions (federation_fingerprint);
--> statement-breakpoint
ALTER TABLE sim_sub_checks ADD COLUMN federation_fingerprint varchar(64);
--> statement-breakpoint
UPDATE manuscript_versions SET content_fingerprint = NULL WHERE content_fingerprint IS NOT NULL;
--> statement-breakpoint
ALTER TABLE submission_periods ADD COLUMN is_contest boolean NOT NULL DEFAULT false;
ALTER TABLE submission_periods ADD COLUMN contest_prize varchar(500);
ALTER TABLE submission_periods ADD COLUMN contest_winners_announced_at timestamptz;
