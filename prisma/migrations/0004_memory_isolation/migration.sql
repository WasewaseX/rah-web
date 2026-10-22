-- CreateTable
CREATE TABLE "MistakeForgiven" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "kind" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MistakeFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "kind" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "evidence" TEXT NOT NULL,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    "streakClean" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" DATETIME
);
INSERT INTO "new_MistakeFamily" ("count", "evidence", "id", "kind", "label", "lastSeen", "resolvedAt", "streakClean", "tag", "updatedAt") SELECT "count", "evidence", "id", "kind", "label", "lastSeen", "resolvedAt", "streakClean", "tag", "updatedAt" FROM "MistakeFamily";
DROP TABLE "MistakeFamily";
ALTER TABLE "new_MistakeFamily" RENAME TO "MistakeFamily";
CREATE INDEX "MistakeFamily_userId_resolvedAt_idx" ON "MistakeFamily"("userId", "resolvedAt");
CREATE INDEX "MistakeFamily_userId_lastSeen_idx" ON "MistakeFamily"("userId", "lastSeen");
CREATE TABLE "new_TagMastery" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "tag" TEXT NOT NULL,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "no" INTEGER NOT NULL DEFAULT 0,
    "ewma" REAL NOT NULL DEFAULT 0.5,
    "lastOk" DATETIME,
    "lastNo" DATETIME,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "tag")
);
INSERT INTO "new_TagMastery" ("ewma", "lastNo", "lastOk", "no", "ok", "tag", "updatedAt") SELECT "ewma", "lastNo", "lastOk", "no", "ok", "tag", "updatedAt" FROM "TagMastery";
DROP TABLE "TagMastery";
ALTER TABLE "new_TagMastery" RENAME TO "TagMastery";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MistakeForgiven_userId_idx" ON "MistakeForgiven"("userId");


-- Data rewrite (Task 65 isolation completion): legacy family ids carried no
-- userId prefix; stamp the singleton key so the new id canon is uniform.
UPDATE "MistakeFamily" SET "id" = 'me:' || "id" WHERE "id" NOT LIKE 'me:%';
