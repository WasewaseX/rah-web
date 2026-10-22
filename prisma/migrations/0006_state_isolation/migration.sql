-- Task 67 (audit P0 residual): CardState + arcade meta + measured bands all
-- become per-user. Every row keeps its data: legacy rows are stamped
-- userId 'me' (the singleton key used before isolation). Row-preserving
-- rebuilds only - never a destructive push.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- FSRS deck queue: (userId, cardId), plus the due-scan index the queue reads.
CREATE TABLE "new_CardState" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "cardId" TEXT NOT NULL,
    "s" REAL NOT NULL DEFAULT 0,
    "d" REAL NOT NULL DEFAULT 0,
    "due" INTEGER NOT NULL DEFAULT 0,
    "last" INTEGER NOT NULL DEFAULT -1,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'new',
    "lastivl" INTEGER NOT NULL DEFAULT 0,
    "dir" TEXT NOT NULL DEFAULT '',
    "suspended" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("userId", "cardId")
);
INSERT INTO "new_CardState" ("cardId", "s", "d", "due", "last", "lapses", "reps", "state", "lastivl", "dir", "suspended") SELECT "cardId", "s", "d", "due", "last", "lapses", "reps", "state", "lastivl", "dir", "suspended" FROM "CardState";
DROP TABLE "CardState";
ALTER TABLE "new_CardState" RENAME TO "CardState";
CREATE INDEX "CardState_userId_due_idx" ON "CardState"("userId", "due");

-- Trophies: (userId, key).
CREATE TABLE "new_Achievement" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "key" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT NOT NULL DEFAULT '',

    PRIMARY KEY ("userId", "key")
);
INSERT INTO "new_Achievement" ("key", "at", "meta") SELECT "key", "at", "meta" FROM "Achievement";
DROP TABLE "Achievement";
ALTER TABLE "new_Achievement" RENAME TO "Achievement";

-- Per-game records: (userId, key).
CREATE TABLE "new_GameStat" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "key" TEXT NOT NULL,
    "best" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "key")
);
INSERT INTO "new_GameStat" ("key", "best", "plays", "updatedAt") SELECT "key", "best", "plays", "updatedAt" FROM "GameStat";
DROP TABLE "GameStat";
ALTER TABLE "new_GameStat" RENAME TO "GameStat";

-- Daily quests: (userId, id) where id is "<day>:<key>".
CREATE TABLE "new_Quest" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fa" TEXT NOT NULL DEFAULT '',
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("userId", "id")
);
INSERT INTO "new_Quest" ("id", "day", "key", "title", "fa", "target", "progress", "done", "xp") SELECT "id", "day", "key", "title", "fa", "target", "progress", "done", "xp" FROM "Quest";
DROP TABLE "Quest";
ALTER TABLE "new_Quest" RENAME TO "Quest";

-- Rubber-band rival: (userId, id), id stays 'me' for legacy rows.
CREATE TABLE "new_Rival" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekXp" INTEGER NOT NULL DEFAULT 0,
    "lastWeekXp" INTEGER NOT NULL DEFAULT 0,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "taunt" TEXT NOT NULL DEFAULT '',

    PRIMARY KEY ("userId", "id")
);
INSERT INTO "new_Rival" ("id", "name", "weekXp", "lastWeekXp", "weekKey", "wins", "losses", "taunt") SELECT "id", "name", "weekXp", "lastWeekXp", "weekKey", "wins", "losses", "taunt" FROM "Rival";
DROP TABLE "Rival";
ALTER TABLE "new_Rival" RENAME TO "Rival";

-- Weekly league: (userId, id).
CREATE TABLE "new_League" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "division" INTEGER NOT NULL DEFAULT 0,
    "history" TEXT NOT NULL DEFAULT '[]',

    PRIMARY KEY ("userId", "id")
);
INSERT INTO "new_League" ("id", "weekKey", "division", "history") SELECT "id", "weekKey", "division", "history" FROM "League";
DROP TABLE "League";
ALTER TABLE "new_League" RENAME TO "League";

-- Server-graded game runs (Dungeon/Gauntlet): (userId, id).
CREATE TABLE "new_RunState" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "id")
);
INSERT INTO "new_RunState" ("id", "day", "state", "updatedAt") SELECT "id", "day", "state", "updatedAt" FROM "RunState";
DROP TABLE "RunState";
ALTER TABLE "new_RunState" RENAME TO "RunState";

-- Measured CEFR band per skill: (userId, skill). Found still-global during the
-- Task-67 sweep - a measured band is learner data.
CREATE TABLE "new_SkillLevel" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "skill" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT '?',
    "score" REAL NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "skill")
);
INSERT INTO "new_SkillLevel" ("skill", "level", "score", "samples", "updatedAt") SELECT "skill", "level", "score", "samples", "updatedAt" FROM "SkillLevel";
DROP TABLE "SkillLevel";
ALTER TABLE "new_SkillLevel" RENAME TO "SkillLevel";

-- Placement state: (userId, id), id stays 'main' for legacy rows.
CREATE TABLE "new_Placement" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL DEFAULT 'main',
    "answers" TEXT NOT NULL DEFAULT '[]',
    "phase" TEXT NOT NULL DEFAULT 'quiz',
    "level" TEXT NOT NULL DEFAULT '?',
    "writingLevel" TEXT NOT NULL DEFAULT '?',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "id")
);
INSERT INTO "new_Placement" ("id", "answers", "phase", "level", "writingLevel", "updatedAt") SELECT "id", "answers", "phase", "level", "writingLevel", "updatedAt" FROM "Placement";
DROP TABLE "Placement";
ALTER TABLE "new_Placement" RENAME TO "Placement";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Materials are the learner's own imported texts (pasted content): stamp the
-- owner. Simple ADD COLUMN - every legacy row belongs to the singleton 'me'.
ALTER TABLE "Material" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'me';
CREATE INDEX "Material_userId_idx" ON "Material"("userId");
