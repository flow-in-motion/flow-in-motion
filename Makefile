build-ApiFunction:
	CI=true pnpm --filter @research-tracker/api build
	lambda_deploy_dir="$$(mktemp -d)"; \
		trap 'rm -rf "$$lambda_deploy_dir"' EXIT; \
		CI=true pnpm --config.node-linker=hoisted --filter @research-tracker/api --prod deploy "$$lambda_deploy_dir"; \
		cp -R "$$lambda_deploy_dir"/. "$(ARTIFACTS_DIR)"/
	rm -rf "$(ARTIFACTS_DIR)/dist"
	cp -R apps/api/dist "$(ARTIFACTS_DIR)/dist"