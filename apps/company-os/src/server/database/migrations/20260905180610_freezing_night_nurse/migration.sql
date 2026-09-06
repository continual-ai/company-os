CREATE TABLE "event_journal_state" (
	"id" integer PRIMARY KEY,
	"position" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_journal" (
	"position" bigint PRIMARY KEY,
	"id" text NOT NULL UNIQUE,
	"transaction_id" text NOT NULL,
	"type" text NOT NULL,
	"version" integer NOT NULL,
	"subjects" jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "event_journal_type_position_idx" ON "event_journal" ("type","position");
--> statement-breakpoint
INSERT INTO "event_journal_state" ("id", "position") VALUES (1, 0);

--> statement-breakpoint
CREATE FUNCTION reject_event_journal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The event journal is append-only' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER event_journal_immutable BEFORE UPDATE OR DELETE ON event_journal
FOR EACH ROW EXECUTE FUNCTION reject_event_journal_mutation();
