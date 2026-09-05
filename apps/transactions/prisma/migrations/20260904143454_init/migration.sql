-- CreateTable
CREATE TABLE "Transaction" (
    "transactionExternalId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(64),
    "bodyHash" VARCHAR(64),
    "accountExternalIdDebit" UUID NOT NULL,
    "accountExternalIdCredit" UUID NOT NULL,
    "value" DECIMAL(19,2) NOT NULL,
    "transferTypeId" INTEGER NOT NULL,
    "transactionStatusId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("transactionExternalId")
);

-- CreateTable
CREATE TABLE "TransactionType" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(32) NOT NULL,

    CONSTRAINT "TransactionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionStatus" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(32) NOT NULL,

    CONSTRAINT "TransactionStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_transactionStatusId_createdAt_idx" ON "Transaction"("transactionStatusId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_transferTypeId_createdAt_idx" ON "Transaction"("transferTypeId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionType_name_key" ON "TransactionType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionStatus_name_key" ON "TransactionStatus"("name");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferTypeId_fkey" FOREIGN KEY ("transferTypeId") REFERENCES "TransactionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transactionStatusId_fkey" FOREIGN KEY ("transactionStatusId") REFERENCES "TransactionStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
