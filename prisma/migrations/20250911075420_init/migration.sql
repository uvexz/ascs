-- CreateEnum
CREATE TYPE "public"."CommentStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sites" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "alternateHostnames" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "pageId" TEXT NOT NULL,
    "status" "public"."CommentStatus" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_configs" (
    "id" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."moderation_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "commentId" TEXT NOT NULL,

    CONSTRAINT "moderation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sites_hostname_key" ON "public"."sites"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "public"."system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_token_key" ON "public"."subscriptions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_email_pageId_siteId_key" ON "public"."subscriptions"("email", "pageId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_tokens_token_key" ON "public"."moderation_tokens"("token");

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_tokens" ADD CONSTRAINT "moderation_tokens_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
