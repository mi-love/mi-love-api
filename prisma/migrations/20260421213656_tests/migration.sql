-- CreateEnum
CREATE TYPE "user_account_status" AS ENUM ('active', 'suspended', 'banned', 'deleted');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "verification_type" AS ENUM ('bvn', 'nin', 'passport', 'drivers_license', 'national_id');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('super_admin', 'moderator', 'finance');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('pending', 'active', 'expired', 'canceled');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'rejected');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email', 'sms');

-- CreateEnum
CREATE TYPE "notification_target" AS ENUM ('all', 'segment', 'user');

-- CreateEnum
CREATE TYPE "report_type" AS ENUM ('csv', 'pdf');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "provider_ref" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_status" "user_account_status" NOT NULL DEFAULT 'active',
ADD COLUMN     "admin_role" "admin_role",
ADD COLUMN     "banned_at" TIMESTAMP(3),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_reason" TEXT,
ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "suspended_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "photos" JSONB,
    "preferences" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "verification_type" NOT NULL,
    "status" "verification_status" NOT NULL DEFAULT 'pending',
    "document_url" TEXT,
    "metadata" JSONB,
    "reason" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" TEXT,
    "os_version" TEXT,
    "app_version" TEXT,
    "ip_address" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_links" (
    "id" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_action_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'pending',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "provider_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "requesterId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "refund_status" NOT NULL DEFAULT 'pending',
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "userId" TEXT,
    "channel" "notification_channel" NOT NULL,
    "target" "notification_target" NOT NULL,
    "status" "status_type" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "variables" JSONB,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "verifications_status_idx" ON "verifications"("status");

-- CreateIndex
CREATE INDEX "verifications_userId_idx" ON "verifications"("userId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_userId_device_id_key" ON "devices"("userId", "device_id");

-- CreateIndex
CREATE INDEX "user_links_sourceUserId_idx" ON "user_links"("sourceUserId");

-- CreateIndex
CREATE INDEX "user_links_targetUserId_idx" ON "user_links"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_links_sourceUserId_targetUserId_key" ON "user_links"("sourceUserId", "targetUserId");

-- CreateIndex
CREATE INDEX "admin_action_logs_adminId_idx" ON "admin_action_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_action_logs_resource_idx" ON "admin_action_logs"("resource");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "refunds_transactionId_idx" ON "refunds"("transactionId");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_name_key" ON "notification_templates"("name");

-- CreateIndex
CREATE INDEX "notification_logs_channel_idx" ON "notification_logs"("channel");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- AddForeignKey
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_links" ADD CONSTRAINT "user_links_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_links" ADD CONSTRAINT "user_links_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
