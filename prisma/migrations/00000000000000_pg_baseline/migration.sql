-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Learner" (
    "id" TEXT NOT NULL DEFAULT 'me',
    "name" TEXT NOT NULL DEFAULT 'Learner',
    "dailyGoal" INTEGER NOT NULL DEFAULT 20,
    "retention" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Learner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Learner',
    "provider" TEXT NOT NULL DEFAULT 'email',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginCode" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardState" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "cardId" TEXT NOT NULL,
    "s" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due" INTEGER NOT NULL DEFAULT 0,
    "last" INTEGER NOT NULL DEFAULT -1,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'new',
    "lastivl" INTEGER NOT NULL DEFAULT 0,
    "dir" TEXT NOT NULL DEFAULT '',
    "suspended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CardState_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "cardId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "ivl" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'review',

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeAck" (
    "gid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeAck_pkey" PRIMARY KEY ("gid")
);

-- CreateTable
CREATE TABLE "MailLog" (
    "id" SERIAL NOT NULL,
    "to" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'login_code',
    "status" TEXT NOT NULL,
    "messageId" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "idemKey" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL DEFAULT 'main',
    "answers" TEXT NOT NULL DEFAULT '[]',
    "phase" TEXT NOT NULL DEFAULT 'quiz',
    "level" TEXT NOT NULL DEFAULT '?',
    "writingLevel" TEXT NOT NULL DEFAULT '?',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "ChatMsg" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMsg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSub" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "prompt" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "parentId" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingSub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakSession" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "prompt" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "result" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "day" INTEGER NOT NULL,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "spoken" INTEGER NOT NULL DEFAULT 0,
    "written" INTEGER NOT NULL DEFAULT 0,
    "listened" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "QuizItem" (
    "id" SERIAL NOT NULL,
    "src" TEXT NOT NULL,
    "quiz" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillLevel" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "skill" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT '?',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "samples" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillLevel_pkey" PRIMARY KEY ("userId","skill")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("userId","key")
);

-- CreateTable
CREATE TABLE "GameStat" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "key" TEXT NOT NULL,
    "best" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameStat_pkey" PRIMARY KEY ("userId","key")
);

-- CreateTable
CREATE TABLE "Quest" (
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

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "Rival" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekXp" INTEGER NOT NULL DEFAULT 0,
    "lastWeekXp" INTEGER NOT NULL DEFAULT 0,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "taunt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Rival_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "League" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "division" INTEGER NOT NULL DEFAULT 0,
    "history" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "League_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "RunState" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunState_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "Briefing" (
    "day" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "MistakeFamily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "kind" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "evidence" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "streakClean" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MistakeFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagMastery" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "tag" TEXT NOT NULL,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "no" INTEGER NOT NULL DEFAULT 0,
    "ewma" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastOk" TIMESTAMP(3),
    "lastNo" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagMastery_pkey" PRIMARY KEY ("userId","tag")
);

-- CreateTable
CREATE TABLE "MistakeForgiven" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "kind" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MistakeForgiven_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'habit',
    "target" TEXT NOT NULL DEFAULT '',
    "dueDay" INTEGER,
    "weeklySessions" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentFlag" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "words" INTEGER NOT NULL DEFAULT 0,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCard" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LoginCode_email_createdAt_idx" ON "LoginCode"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "CardState_userId_due_idx" ON "CardState"("userId", "due");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_idx" ON "ReviewLog"("userId");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_day_idx" ON "ReviewLog"("userId", "day");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_cardId_idx" ON "ReviewLog"("userId", "cardId");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_grade_idx" ON "ReviewLog"("userId", "grade");

-- CreateIndex
CREATE INDEX "GradeAck_at_idx" ON "GradeAck"("at");

-- CreateIndex
CREATE UNIQUE INDEX "MailLog_idemKey_key" ON "MailLog"("idemKey");

-- CreateIndex
CREATE INDEX "ChatMsg_userId_idx" ON "ChatMsg"("userId");

-- CreateIndex
CREATE INDEX "ChatMsg_userId_at_idx" ON "ChatMsg"("userId", "at");

-- CreateIndex
CREATE INDEX "WritingSub_userId_idx" ON "WritingSub"("userId");

-- CreateIndex
CREATE INDEX "SpeakSession_userId_idx" ON "SpeakSession"("userId");

-- CreateIndex
CREATE INDEX "MistakeFamily_userId_resolvedAt_idx" ON "MistakeFamily"("userId", "resolvedAt");

-- CreateIndex
CREATE INDEX "MistakeFamily_userId_lastSeen_idx" ON "MistakeFamily"("userId", "lastSeen");

-- CreateIndex
CREATE INDEX "MistakeForgiven_userId_idx" ON "MistakeForgiven"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_archivedAt_idx" ON "Goal"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "Material_userId_idx" ON "Material"("userId");

-- CreateIndex
CREATE INDEX "MaterialCard_materialId_idx" ON "MaterialCard"("materialId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCard" ADD CONSTRAINT "MaterialCard_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

