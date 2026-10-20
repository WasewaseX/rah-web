-- CreateTable
CREATE TABLE "Learner" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'me',
    "name" TEXT NOT NULL DEFAULT 'Learner',
    "dailyGoal" INTEGER NOT NULL DEFAULT 20,
    "retention" REAL NOT NULL DEFAULT 0.9,
    "newPerDay" INTEGER NOT NULL DEFAULT 10,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDay" INTEGER NOT NULL DEFAULT -1,
    "level" TEXT NOT NULL DEFAULT '?',
    "placementPhase" TEXT NOT NULL DEFAULT 'none',
    "focusSkill" TEXT NOT NULL DEFAULT 'vocabulary',
    "theme" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'coach',
    "modeData" TEXT NOT NULL DEFAULT '',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "freezes" INTEGER NOT NULL DEFAULT 0,
    "chain" INTEGER NOT NULL DEFAULT 0,
    "chainDay" INTEGER NOT NULL DEFAULT -1,
    "sp" INTEGER NOT NULL DEFAULT 0,
    "perks" TEXT NOT NULL DEFAULT '',
    "persona" TEXT NOT NULL DEFAULT 'mentor',
    "gems" INTEGER NOT NULL DEFAULT 0,
    "boostUntil" INTEGER NOT NULL DEFAULT -1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Learner',
    "provider" TEXT NOT NULL DEFAULT 'email',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoginCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CardState" (
    "cardId" TEXT NOT NULL PRIMARY KEY,
    "s" REAL NOT NULL DEFAULT 0,
    "d" REAL NOT NULL DEFAULT 0,
    "due" INTEGER NOT NULL DEFAULT 0,
    "last" INTEGER NOT NULL DEFAULT -1,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'new',
    "lastivl" INTEGER NOT NULL DEFAULT 0,
    "dir" TEXT NOT NULL DEFAULT '',
    "suspended" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "ivl" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'review'
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "answers" TEXT NOT NULL DEFAULT '[]',
    "phase" TEXT NOT NULL DEFAULT 'quiz',
    "level" TEXT NOT NULL DEFAULT '?',
    "writingLevel" TEXT NOT NULL DEFAULT '?',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatMsg" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WritingSub" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prompt" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SpeakSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prompt" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "result" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "day" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "spoken" INTEGER NOT NULL DEFAULT 0,
    "written" INTEGER NOT NULL DEFAULT 0,
    "listened" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "QuizItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "src" TEXT NOT NULL,
    "quiz" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SkillLevel" (
    "skill" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL DEFAULT '?',
    "score" REAL NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Achievement" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "GameStat" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "best" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fa" TEXT NOT NULL DEFAULT '',
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Rival" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "weekXp" INTEGER NOT NULL DEFAULT 0,
    "lastWeekXp" INTEGER NOT NULL DEFAULT 0,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "taunt" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "division" INTEGER NOT NULL DEFAULT 0,
    "history" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "RunState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Briefing" (
    "day" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL DEFAULT '',
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MistakeFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "evidence" TEXT NOT NULL,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "streakClean" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "TagMastery" (
    "tag" TEXT NOT NULL PRIMARY KEY,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "no" INTEGER NOT NULL DEFAULT 0,
    "ewma" REAL NOT NULL DEFAULT 0.5,
    "lastOk" DATETIME,
    "lastNo" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContentFlag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cardId" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LoginCode_email_createdAt_idx" ON "LoginCode"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

