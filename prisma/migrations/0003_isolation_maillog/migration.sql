-- CreateTable
CREATE TABLE "MailLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "to" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'login_code',
    "status" TEXT NOT NULL,
    "messageId" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "idemKey" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMsg" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ChatMsg" ("at", "content", "id", "role") SELECT "at", "content", "id", "role" FROM "ChatMsg";
DROP TABLE "ChatMsg";
ALTER TABLE "new_ChatMsg" RENAME TO "ChatMsg";
CREATE INDEX "ChatMsg_userId_idx" ON "ChatMsg"("userId");
CREATE TABLE "new_ReviewLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "cardId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "ivl" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'review'
);
INSERT INTO "new_ReviewLog" ("at", "cardId", "day", "grade", "id", "ivl", "source") SELECT "at", "cardId", "day", "grade", "id", "ivl", "source" FROM "ReviewLog";
DROP TABLE "ReviewLog";
ALTER TABLE "new_ReviewLog" RENAME TO "ReviewLog";
CREATE INDEX "ReviewLog_userId_idx" ON "ReviewLog"("userId");
CREATE TABLE "new_SpeakSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "prompt" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "result" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SpeakSession" ("at", "id", "prompt", "result", "round", "transcript") SELECT "at", "id", "prompt", "result", "round", "transcript" FROM "SpeakSession";
DROP TABLE "SpeakSession";
ALTER TABLE "new_SpeakSession" RENAME TO "SpeakSession";
CREATE INDEX "SpeakSession_userId_idx" ON "SpeakSession"("userId");
CREATE TABLE "new_WritingSub" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "prompt" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "parentId" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_WritingSub" ("at", "id", "prompt", "result", "text") SELECT "at", "id", "prompt", "result", "text" FROM "WritingSub";
DROP TABLE "WritingSub";
ALTER TABLE "new_WritingSub" RENAME TO "WritingSub";
CREATE INDEX "WritingSub_userId_idx" ON "WritingSub"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MailLog_idemKey_key" ON "MailLog"("idemKey");

