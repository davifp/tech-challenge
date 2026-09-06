-- CreateTable
CREATE TABLE "OutboxEvent" (
    "eventId" UUID NOT NULL,
    "aggregateId" UUID NOT NULL,
    "eventName" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_nextAttemptAt_idx" ON "OutboxEvent"("publishedAt", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_aggregateId_fkey" FOREIGN KEY ("aggregateId") REFERENCES "Transaction"("transactionExternalId") ON DELETE RESTRICT ON UPDATE CASCADE;
