-- Offline-ack consolidation (Task 69/72, 2026-10-23): the lost wave shipped
-- TWO idempotency designs in one day - this table (GradeAck, full response
-- keyed by gid) and the lighter clientRef column on ReviewLog. The clientRef
-- design is the one that survived in code (the grade route dedupes on it, so
-- a replayed grade can never double-apply FSRS/XP/streak). This migration
-- drops the orphaned table so every database - live, restored, fresh - ends
-- with exactly one mechanism and schema == prisma.prisma.
DROP TABLE IF EXISTS "GradeAck";
