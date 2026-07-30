-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'comment';

-- AlterTable comments
ALTER TABLE "comments" ADD COLUMN "parentId" TEXT,
ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "comments" ALTER COLUMN "content" SET DATA TYPE TEXT;

-- AlterTable messages
ALTER TABLE "messages" ADD COLUMN "replyToMessageId" TEXT;

-- AlterTable notifications
ALTER TABLE "notifications" ADD COLUMN "metadata" JSONB;

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_postId_created_at_idx" ON "comments"("postId", "created_at");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "messages_chatId_created_at_idx" ON "messages"("chatId", "created_at");

-- CreateIndex
CREATE INDEX "messages_replyToMessageId_idx" ON "messages"("replyToMessageId");

-- CreateIndex
CREATE INDEX "message_reactions_messageId_idx" ON "message_reactions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_messageId_userId_key" ON "message_reactions"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
