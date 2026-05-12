ALTER TABLE "books" ADD COLUMN "subgenre" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "target_audience" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "content_warnings" text[];--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "comp_titles" text[];--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "series_name" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "series_number" integer;