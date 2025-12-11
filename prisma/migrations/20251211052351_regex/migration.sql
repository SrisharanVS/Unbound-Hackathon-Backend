-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('AUTO_REJECT', 'AUTO_ACCEPT');

-- CreateTable
CREATE TABLE "RegexRule" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "action" "RuleAction" NOT NULL,
    "exampleMatch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegexRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegexRule_pattern_key" ON "RegexRule"("pattern");
