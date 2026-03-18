-- ─── Allow trip members to delete messages ────────────────────────────────────
-- Without this policy the bulk DELETE in archiveAndClear() silently deletes 0
-- rows for messages owned by other users (RLS blocks it), causing archived
-- messages to reappear on page refresh.

CREATE POLICY "Trip members can delete messages"
  ON trip_group_messages FOR DELETE
  USING (
    trip_id IN (
      SELECT id       FROM trips    WHERE owner_id       = auth.uid()
      UNION ALL
      SELECT trip_id  FROM travelers WHERE linked_user_id = auth.uid()
    )
  );
