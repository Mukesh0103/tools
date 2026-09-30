ALTER TABLE "generations" DROP COLUMN "prompt_version";--> statement-breakpoint
ALTER TABLE "generations" DROP COLUMN "model";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "default_tone";--> statement-breakpoint
DROP TYPE "public"."tone";