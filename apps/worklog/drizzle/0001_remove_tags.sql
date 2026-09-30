UPDATE "entries" SET "text" = "text" || ' ' || array_to_string("tags", ' ') WHERE cardinality("tags") > 0;--> statement-breakpoint
ALTER TABLE "entries" DROP COLUMN "tags";
