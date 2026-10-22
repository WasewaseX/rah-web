-- Convergence migration (parallel-wave merge, 2026-10-23): a local wave that
-- had picked a DIFFERENT offline-ack design (ReviewLog.clientRef) applied
-- 0008_offline_ack_consolidate to the shared live DB, which dropped GradeAck -
-- the receipt table the CANONICAL wave's offline sync (Tasks 68/78) reads and
-- writes. This migration restores the exact Task-68 shape on any database
-- that dropped it; on fresh chains (0007 already created it) it is a no-op
-- rebuild. GradeAck is load-bearing again: gid receipts for review grades AND
-- the solo arcade outbox.
DROP TABLE IF EXISTS "GradeAck";
CREATE TABLE "GradeAck" (
    "gid" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
