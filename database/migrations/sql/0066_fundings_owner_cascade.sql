ALTER TABLE "fundings" DROP CONSTRAINT "fundings_owner_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "fundings" ADD CONSTRAINT "fundings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;