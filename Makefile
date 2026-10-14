# Both functions ship the same artifact: each handler bundled into one
# self-contained file (no node_modules), which makes Lambda cold starts much
# faster. The smoke test boots the bundle and fails the build if it can't.
build-ApiFunction build-CleanupFunction:
	CI=true pnpm --filter @research-tracker/api build
	rm -rf "$(ARTIFACTS_DIR)/dist"
	node apps/api/scripts/bundle-lambda.mjs apps/api/dist "$(ARTIFACTS_DIR)/dist"
	node apps/api/scripts/smoke-lambda-bundle.mjs "$(ARTIFACTS_DIR)/dist"
