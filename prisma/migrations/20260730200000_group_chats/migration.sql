-- CreateEnum
CREATE TYPE "chat_type" AS ENUM ('direct', 'group');

-- CreateEnum
CREATE TYPE "participant_role" AS ENUM ('owner', 'admin', 'member');

-- AlterTable chats
ALTER TABLE "chats" ADD COLUMN "type" "chat_type" NOT NULL DEFAULT 'direct';
ALTER TABLE "chats" ADD COLUMN "name" TEXT;
ALTER TABLE "chats" ADD COLUMN "avatarId" TEXT;

-- AlterTable participants
ALTER TABLE "participants" ADD COLUMN "role" "participant_role" NOT NULL DEFAULT 'member';

-- Deduplicate participants before unique index (keep earliest row)
DELETE FROM "participants" a
USING "participants" b
WHERE a."chatId" = b."chatId"
  AND a."userId" = b."userId"
  AND a."created_at" > b."created_at";

-- CreateIndex
CREATE INDEX "chats_type_idx" ON "chats"("type");

-- CreateIndex
CREATE INDEX "participants_userId_idx" ON "participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_chatId_userId_key" ON "participants"("chatId", "userId");

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
