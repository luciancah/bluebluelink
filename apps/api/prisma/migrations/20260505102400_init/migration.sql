CREATE TYPE "ShareSessionStatus" AS ENUM ('active', 'expired', 'stopped');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "share_sessions" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "session_code" TEXT NOT NULL,
  "session_name" TEXT NOT NULL,
  "status" "ShareSessionStatus" NOT NULL DEFAULT 'active',
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "last_updated_location" TIMESTAMPTZ(3),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "accuracy_meters" DOUBLE PRECISION,
  "pin_code_hash" TEXT,
  "destination_name" TEXT,
  "destination_lat" DOUBLE PRECISION,
  "destination_lng" DOUBLE PRECISION,
  "stopped_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "share_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "share_sessions_session_code_key" ON "share_sessions"("session_code");
CREATE INDEX "share_sessions_owner_id_status_idx" ON "share_sessions"("owner_id", "status");
CREATE INDEX "share_sessions_status_expires_at_idx" ON "share_sessions"("status", "expires_at");

ALTER TABLE "share_sessions"
  ADD CONSTRAINT "share_sessions_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
