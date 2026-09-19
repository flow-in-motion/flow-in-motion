locals {
  name_prefix       = "flow-in-motion-${var.environment}"
  state_bucket_name = "flow-in-motion-opentofu-state-${data.aws_caller_identity.current.account_id}"
  state_key         = "flow-in-motion/production/opentofu.tfstate"

  api_function_name     = "${local.name_prefix}-api"
  cleanup_function_name = "${local.name_prefix}-cleanup"
  api_domain_name       = "api.${var.domain_name}"

  cors_allowed_origins = [
    for origin in [
      var.amplify_test_origin,
      var.frontend_origin,
    ] : origin
    if origin != null && origin != ""
  ]

  common_lambda_environment = {
    NODE_ENV                    = "production"
    LOG_LEVEL                   = "info"
    APP_URL                     = var.frontend_origin
    PAGE_SIZE                   = "20"
    POSTGRES_CONNECT_TIMEOUT_MS = "5000"
    POSTGRES_QUERY_TIMEOUT_MS   = "10000"
    POSTGRES_IDLE_TIMEOUT_MS    = "10000"
    SUPABASE_URL                = var.supabase_url
    SUPABASE_JWT_AUDIENCE       = "authenticated"
    INVITATION_EMAIL_FROM       = "no-reply@${var.domain_name}"
    INVITATION_EMAIL_REGION     = var.aws_region
  }
}

data "aws_route53_zone" "primary" {
  name         = var.domain_name
  private_zone = false
}
