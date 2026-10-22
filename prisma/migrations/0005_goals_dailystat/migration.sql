-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'habit',
    "target" TEXT NOT NULL DEFAULT '',
    "dueDay" INTEGER,
    "weeklySessions" INTEGER NOT NULL DEFAULT 4,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyStat" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "day" INTEGER NOT NULL,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "spoken" INTEGER NOT NULL DEFAULT 0,
    "written" INTEGER NOT NULL DEFAULT 0,
    "listened" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("userId", "day")
);
INSERT INTO "new_DailyStat" ("correct", "day", "listened", "reviews", "spoken", "written", "xp") SELECT "correct", "day", "listened", "reviews", "spoken", "written", "xp" FROM "DailyStat";
DROP TABLE "DailyStat";
ALTER TABLE "new_DailyStat" RENAME TO "DailyStat";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Goal_userId_archivedAt_idx" ON "Goal"("userId", "archivedAt");

