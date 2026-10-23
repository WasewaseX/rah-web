-- 0010_perf_indexes (Task 89): hot-path composite indexes. Additive only -
-- every statement is CREATE INDEX, so the migration can never lose a row.
-- ReviewLog(userId, day): per-day stats rollups and the DailyStat honesty
--   checks that group review history by day.
-- ReviewLog(userId, cardId): the Task-87 partial-loss repair trigger scans
--   exactly this shape for every (userId, cardId) key.
-- ReviewLog(userId, grade): buildProfile's recent-lapse reads (grade=1, newest
--   first) run on every coach-agent call.
-- ChatMsg(userId, at): coach history reads order by time within a user.
-- GradeAck(at): the 7-day receipt purge on every write scans by age.
CREATE INDEX "ReviewLog_userId_day_idx" ON "ReviewLog"("userId", "day");
CREATE INDEX "ReviewLog_userId_cardId_idx" ON "ReviewLog"("userId", "cardId");
CREATE INDEX "ReviewLog_userId_grade_idx" ON "ReviewLog"("userId", "grade");
CREATE INDEX "ChatMsg_userId_at_idx" ON "ChatMsg"("userId", "at");
CREATE INDEX "GradeAck_at_idx" ON "GradeAck"("at");
