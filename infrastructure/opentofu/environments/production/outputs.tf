output "api_function_name" {
  description = "Production API Lambda function name."
  value       = aws_lambda_function.api.function_name
}

output "cleanup_function_name" {
  description = "Scheduled cleanup Lambda function name."
  value       = aws_lambda_function.cleanup.function_name
}

output "api_gateway_endpoint" {
  description = "Default API Gateway endpoint used for initial verification."
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "api_custom_domain" {
  description = "Production API custom domain."
  value       = "https://${aws_apigatewayv2_domain_name.api.domain_name}"
}

output "cleanup_schedule_name" {
  description = "Daily EventBridge Scheduler schedule."
  value       = aws_scheduler_schedule.cleanup.name
}

output "github_deployment_role_arn" {
  description = "IAM role assumed by GitHub Actions through OIDC."
  value       = aws_iam_role.github_deployment.arn
}

output "operations_topic_arn" {
  description = "SNS topic used by production CloudWatch alarms."
  value       = aws_sns_topic.operations.arn
}