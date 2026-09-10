CREATE TABLE "application_event_logs" (
  "id" UUID NOT NULL,
  "company_id" UUID,
  "branch_id" UUID,
  "user_id" UUID,
  "level" VARCHAR(20) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "message" VARCHAR(1000) NOT NULL,
  "context" JSONB,
  "error_stack" TEXT,
  "correlation_id" VARCHAR(128),
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "application_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_event_logs_company_occurred_idx" ON "application_event_logs"("company_id", "occurred_at");
CREATE INDEX "application_event_logs_level_occurred_idx" ON "application_event_logs"("level", "occurred_at");
