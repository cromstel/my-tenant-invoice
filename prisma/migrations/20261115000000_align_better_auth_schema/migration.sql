-- Align the live database with prisma/schema.prisma for Better Auth 1.7.
--
-- The database was created from an older Better Auth table shape (Account with
-- provider/providerAccountId, Session without token/expiresAt). Better Auth
-- 1.7 queries Account.providerId and Session.token, so every sign-in failed
-- with "The column `Account.providerId` does not exist in the current
-- database".
--
-- This migration is additive: it adds the missing columns, creates the
-- Verification table Better Auth expects, and swaps the legacy account unique
-- index for the (providerId, accountId) index the current schema declares.
-- No rows are dropped or rewritten; account and session were empty.

-- DropIndex
DROP INDEX `Account_provider_providerAccountId_key` ON `Account`;

-- AlterTable
ALTER TABLE `Account`
    ADD COLUMN `accessTokenExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `accountId` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `password` VARCHAR(191) NULL,
    ADD COLUMN `providerId` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `refreshTokenExpiresAt` DATETIME(3) NULL,
    MODIFY `type` VARCHAR(191) NULL,
    MODIFY `provider` VARCHAR(191) NULL,
    MODIFY `providerAccountId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Session`
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `expiresAt` DATETIME(3) NOT NULL,
    ADD COLUMN `ipAddress` VARCHAR(191) NULL,
    ADD COLUMN `token` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `userAgent` VARCHAR(191) NULL,
    MODIFY `sessionToken` VARCHAR(191) NULL,
    MODIFY `expires` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `passwordHash` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Verification` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `verification_identifier_value_key`(`identifier`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Account_providerId_accountId_key` ON `Account`(`providerId`, `accountId`);

-- CreateIndex
CREATE UNIQUE INDEX `Session_token_key` ON `Session`(`token`);
