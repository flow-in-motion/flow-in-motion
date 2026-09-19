resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.api_function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "cleanup" {
  name              = "/aws/lambda/${local.cleanup_function_name}"
  retention_in_days = 14
}

resource "aws_sqs_queue" "cleanup_dlq" {
  name                      = "${local.cleanup_function_name}-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  max_message_size          = 1048576
}

resource "aws_sns_topic" "operations" {
  name = "${local.name_prefix}-operations"
}

resource "aws_sns_topic_subscription" "operations_email" {
  topic_arn = aws_sns_topic.operations.arn
  protocol  = "email"
  endpoint  = var.budget_notification_email
}

resource "aws_cloudwatch_metric_alarm" "api_errors" {
  alarm_name          = "${local.api_function_name}-errors"
  alarm_description   = "The production API Lambda returned one or more errors."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = local.api_function_name
  }

  alarm_actions = [aws_sns_topic.operations.arn]
  ok_actions    = [aws_sns_topic.operations.arn]
}

resource "aws_cloudwatch_metric_alarm" "cleanup_errors" {
  alarm_name          = "${local.cleanup_function_name}-errors"
  alarm_description   = "The scheduled cleanup Lambda returned one or more errors."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = local.cleanup_function_name
  }

  alarm_actions = [aws_sns_topic.operations.arn]
  ok_actions    = [aws_sns_topic.operations.arn]
}

resource "aws_cloudwatch_metric_alarm" "cleanup_dlq_messages" {
  alarm_name          = "${local.cleanup_function_name}-dlq-messages"
  alarm_description   = "A scheduled cleanup invocation exhausted its retries."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.cleanup_dlq.name
  }

  alarm_actions = [aws_sns_topic.operations.arn]
}