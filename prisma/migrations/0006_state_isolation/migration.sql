-- Task-72 reconstruction (2026-10-23): this migration was applied to the live
-- DB by a lost workspace wave whose FILES died in a reprovision while the DB
-- survived (the REG-3 data-vs-code drift class). The SQL below reproduces the
-- applied schema exactly - verified column-by-column against the live DB -
-- so fresh databases (battery stack, future rebuilds) converge to the same
-- shape. Rebuilds are row-preserving: legacy rows land under the singleton
-- key 'me', matching every other isolation migration (0003/0004/0005).

-- Per-user scoping: CardState (the FSRS deck queue), Placement, SkillLevel,
-- Achievement, GameStat, Quest, Rival, League, RunState - the last global
-- aggregate keys. No learner prose lives in these tables (names/labels are
-- engine-generated), which is what made the deployment-lock era safe; they
-- are scoped now so the multi-user push has no residual.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

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
INSERT INTO "new_CardState" ("userId", "cardId", "s", "d", "due", "last", "lapses", "reps", "state", "lastivl", "dir", "suspended") SELECT 'me', "cardId", "s", "d", "due", "last", "lapses", "reps", "state", "lastivl", "dir", "suspended" FROM "CardState";
DROP TABLE "CardState";
ALTER TABLE "new_CardState" RENAME TO "CardState";
CREATE INDEX "CardState_userId_due_idx" ON "CardState"("userId", "due");

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
INSERT INTO "new_Placement" ("userId", "id", "answers", "phase", "level", "writingLevel", "updatedAt") SELECT 'me', "id", "answers", "phase", "level", "writingLevel", "updatedAt" FROM "Placement";
DROP TABLE "Placement";
ALTER TABLE "new_Placement" RENAME TO "Placement";

CREATE TABLE "new_SkillLevel" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "skill" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT '?',
    "score" REAL NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "skill")
);
INSERT INTO "new_SkillLevel" ("userId", "skill", "level", "score", "samples", "updatedAt") SELECT 'me', "skill", "level", "score", "samples", "updatedAt" FROM "SkillLevel";
DROP TABLE "SkillLevel";
ALTER TABLE "new_SkillLevel" RENAME TO "SkillLevel";

CREATE TABLE "new_Achievement" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "key" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT NOT NULL DEFAULT '',

    PRIMARY KEY ("userId", "key")
);
INSERT INTO "new_Achievement" ("userId", "key", "at", "meta") SELECT 'me', "key", "at", "meta" FROM "Achievement";
DROP TABLE "Achievement";
ALTER TABLE "new_Achievement" RENAME TO "Achievement";

CREATE TABLE "new_GameStat" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "key" TEXT NOT NULL,
    "best" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "key")
);
INSERT INTO "new_GameStat" ("userId", "key", "best", "plays", "updatedAt") SELECT 'me', "key", "best", "plays", "updatedAt" FROM "GameStat";
DROP TABLE "GameStat";
ALTER TABLE "new_GameStat" RENAME TO "GameStat";

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
INSERT INTO "new_Quest" ("userId", "id", "day", "key", "title", "fa", "target", "progress", "done", "xp") SELECT 'me', "id", "day", "key", "title", "fa", "target", "progress", "done", "xp" FROM "Quest";
DROP TABLE "Quest";
ALTER TABLE "new_Quest" RENAME TO "Quest";

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
INSERT INTO "new_Rival" ("userId", "id", "name", "weekXp", "lastWeekXp", "weekKey", "wins", "losses", "taunt") SELECT 'me', "id", "name", "weekXp", "lastWeekXp", "weekKey", "wins", "losses", "taunt" FROM "Rival";
DROP TABLE "Rival";
ALTER TABLE "new_Rival" RENAME TO "Rival";

CREATE TABLE "new_League" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "division" INTEGER NOT NULL DEFAULT 0,
    "history" TEXT NOT NULL DEFAULT '[]',

    PRIMARY KEY ("userId", "id")
);
INSERT INTO "new_League" ("userId", "id", "weekKey", "division", "history") SELECT 'me', "id", "weekKey", "division", "history" FROM "League";
DROP TABLE "League";
ALTER TABLE "new_League" RENAME TO "League";

CREATE TABLE "new_RunState" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "id")
);
INSERT INTO "new_RunState" ("userId", "id", "day", "state", "updatedAt") SELECT 'me', "id", "day", "state", "updatedAt" FROM "RunState";
DROP TABLE "RunState";
ALTER TABLE "new_RunState" RENAME TO "RunState";

CREATE TABLE "new_Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "words" INTEGER NOT NULL DEFAULT 0,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Material" ("id", "userId", "title", "source", "text", "words", "degraded", "createdAt") SELECT "id", 'me', "title", "source", "text", "words", "degraded", "createdAt" FROM "Material";
DROP TABLE "Material";
ALTER TABLE "new_Material" RENAME TO "Material";
CREATE INDEX "Material_userId_idx" ON "Material"("userId");

PRAGMA foreign_keys=ON;
