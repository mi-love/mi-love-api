-- CreateEnum
CREATE TYPE "upload_job_status" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "upload_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "upload_job_status" NOT NULL DEFAULT 'queued',
    "originalName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "localPath" TEXT,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "fileId" TEXT,
    "bullJobId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_jobs_fileId_key" ON "upload_jobs"("fileId");

-- CreateIndex
CREATE INDEX "upload_jobs_userId_created_at_idx" ON "upload_jobs"("userId", "created_at");

-- CreateIndex
CREATE INDEX "upload_jobs_status_idx" ON "upload_jobs"("status");

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
