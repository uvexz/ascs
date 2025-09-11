-- Create enum type for comment status
CREATE TYPE "CommentStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- Add status column to comments table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'status') THEN
        ALTER TABLE "public"."comments" ADD COLUMN "status" VARCHAR(9) DEFAULT 'APPROVED';
    END IF;
END
$$;

-- Update comments table to use the new enum type
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'status') THEN
        ALTER TABLE "public"."comments" ALTER COLUMN "status" TYPE "CommentStatus" USING
            CASE
                WHEN "status"::TEXT = 'APPROVED' THEN 'APPROVED'::"CommentStatus"
                WHEN "status"::TEXT = 'PENDING' THEN 'PENDING'::"CommentStatus"
                WHEN "status"::TEXT = 'REJECTED' THEN 'REJECTED'::"CommentStatus"
                ELSE 'APPROVED'::"CommentStatus"
            END;
    END IF;
END
$$;

-- Create ai_configs table
CREATE TABLE "ai_configs" (
    "id" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);