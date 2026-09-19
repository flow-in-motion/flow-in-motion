resource "aws_scheduler_schedule" "cleanup" {
  name        = "${local.name_prefix}-daily-cleanup"
  description = "Permanently remove projects and papers archived over 14 days"

  state                        = "ENABLED"
  schedule_expression          = "cron(0 2 * * ? *)"
  schedule_expression_timezone = "Australia/Sydney"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.cleanup.arn
    role_arn = aws_iam_role.cleanup_scheduler.arn
    input    = jsonencode({ source = "flow-in-motion.archive-cleanup" })

    retry_policy {
      maximum_event_age_in_seconds = 3600
      maximum_retry_attempts       = 2
    }

    dead_letter_config {
      arn = aws_sqs_queue.cleanup_dlq.arn
    }
  }

  depends_on = [
    aws_iam_role_policy.cleanup_scheduler,
  ]
}
