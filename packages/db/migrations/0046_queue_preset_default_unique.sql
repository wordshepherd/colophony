CREATE UNIQUE INDEX "saved_queue_presets_one_default_per_user_idx"
  ON "saved_queue_presets" ("organization_id", "user_id")
  WHERE "is_default" = true;
