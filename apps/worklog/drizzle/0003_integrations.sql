CREATE TYPE "public"."entry_source" AS ENUM('manual', 'github', 'jira');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('github', 'jira');--> statement-breakpoint
CREATE TABLE "entry_dismissals" (
	"user_id" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_dismissals_user_id_external_id_pk" PRIMARY KEY("user_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"user_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"site_url" text,
	"email" text,
	"secret" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "source" "entry_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_summaries" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "entry_dismissals" ADD CONSTRAINT "entry_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_user_external_idx" ON "entries" USING btree ("user_id","external_id");