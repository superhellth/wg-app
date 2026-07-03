-- Data backfill for the coupled weekly-rota redesign (docs/chore-rota-redesign.md).
-- 0005 added wg.rotation with an empty default; existing members were never
-- appended (the append hook only runs on new adds). Seed it from the current
-- active roster in join order. Idempotent: only fills when still empty.
UPDATE "wg" SET "rotation" = COALESCE(
    (SELECT jsonb_agg(m."id" ORDER BY m."created_at")
     FROM "members" m WHERE m."archived_at" IS NULL),
    '[]'::jsonb
  )
  WHERE jsonb_array_length("rotation") = 0;
--> statement-breakpoint
-- Repair open turns: point rotation_index at the assignee's slot in the new
-- shared rotation (the old per-chore rotation column is gone). Leaves turns
-- whose assignee is no longer in the rotation untouched.
UPDATE "chore_turns" ct SET "rotation_index" = r.idx
  FROM (
    SELECT e.mid, (e.ord - 1)::int AS idx
    FROM "wg" w, jsonb_array_elements_text(w."rotation") WITH ORDINALITY AS e(mid, ord)
  ) r
  WHERE r.mid = ct."assignee_id"::text
    AND ct."completed_at" IS NULL
    AND ct."skipped_at" IS NULL;
