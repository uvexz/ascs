-- Add alternateHostnames column to sites table
ALTER TABLE "public"."sites" ADD COLUMN "alternateHostnames" TEXT;