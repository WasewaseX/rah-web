-- Task 68 (audit P1: real offline sync): receipts for offline-graded reviews.
-- The client queues grades locally when the network is gone, replays them on
-- reconnect, and the server answers a replay with the ORIGINAL response, so a
-- double flush can never double-count XP, streaks or quest progress.

-- CreateTable
CREATE TABLE "GradeAck" (
    "gid" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
