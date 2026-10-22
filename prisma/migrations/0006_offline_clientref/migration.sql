-- Offline-sync idempotency (Task 69): every offline-queued review grade
-- carries a clientRef; the grade route refuses to apply the same ref twice
-- (a flaky network can replay a request whose commit already landed).
-- Nullable + sparse usage: live grades never send it.
ALTER TABLE "ReviewLog" ADD COLUMN "clientRef" TEXT;
CREATE INDEX "ReviewLog_clientRef_idx" ON "ReviewLog"("clientRef");
