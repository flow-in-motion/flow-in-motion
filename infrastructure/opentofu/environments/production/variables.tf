variable "aws_region" {
  description = "AWS region used for the production application."
  type        = string
  default     = "ap-southeast-2"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Registered Route 53 domain."
  type        = string
  default     = "flowinmotion.org"
}

variable "frontend_origin" {
  description = "Production frontend origin allowed by API Gateway CORS."
  type        = string
  default     = "https://app.flowinmotion.org"

  validation {
    condition     = startswith(var.frontend_origin, "https://")
    error_message = "frontend_origin must use HTTPS."
  }
}

variable "amplify_test_origin" {
  description = "Temporary Amplify test origin allowed during deployment setup."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition = (
      var.amplify_test_origin == null
      ? true
      : startswith(var.amplify_test_origin, "https://")
    )
    error_message = "amplify_test_origin must use HTTPS when provided."
  }
}

variable "supabase_url" {
  description = "HTTPS URL of the production Supabase project."
  type        = string

  validation {
    condition     = startswith(var.supabase_url, "https://")
    error_message = "supabase_url must use HTTPS."
  }
}

variable "database_secret_name" {
  description = "Secrets Manager secret containing the Supabase pooler connection fields."
  type        = string
  default     = "flow-in-motion/production/api-database"
}

variable "github_repository" {
  description = "GitHub repository permitted to assume the deployment role."
  type        = string
  default     = "flow-in-motion/flow-in-motion"
}

variable "github_deployment_branch" {
  description = "GitHub branch permitted to deploy production."
  type        = string
  default     = "main"
}

variable "budget_notification_email" {
  description = "Email address that receives AWS Budget notifications."
  type        = string
  sensitive   = true
}

variable "monthly_budget_limit_usd" {
  description = "Maximum monthly AWS budget in USD."
  type        = number
  default     = 30
}

variable "lambda_package_path" {
  description = "Absolute or repository-relative path to the production Lambda ZIP package."
  type        = string
}