-- CreateTable
CREATE TABLE "InboxEvent" (
    "eventId" UUID NOT NULL,
    "eventName" VARCHAR(128) NOT NULL,
    "transactionExternalId" UUID NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "InboxEvent_transactionExternalId_idx" ON "InboxEvent"("transactionExternalId");

-- AddForeignKey
ALTER TABLE "InboxEvent" ADD CONSTRAINT "InboxEvent_transactionExternalId_fkey" FOREIGN KEY ("transactionExternalId") REFERENCES "Transaction"("transactionExternalId") ON DELETE RESTRICT ON UPDATE CASCADE;
