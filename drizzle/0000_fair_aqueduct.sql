CREATE TABLE `rating_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer NOT NULL,
	`ticket` text NOT NULL,
	CONSTRAINT "rating_limits_count_positive" CHECK("rating_limits"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`run_id` text NOT NULL,
	`voter_hash` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`run_id`, `voter_hash`),
	CONSTRAINT "ratings_score_1_10" CHECK("ratings"."score" >= 1 AND "ratings"."score" <= 10 AND typeof("ratings"."score") = 'integer')
);
