data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api_lambda" {
  name               = "${local.name_prefix}-api-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "api_lambda" {
  statement {
    sid = "WriteLambdaLogs"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }

  statement {
    sid       = "ReadDatabaseSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.database.arn]
  }

  statement {
    sid = "SendTransactionalEmail"

    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]

    resources = [
      "arn:${data.aws_partition.current.partition}:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.domain_name}",
    ]
  }
}

resource "aws_iam_role_policy" "api_lambda" {
  name   = "flow-in-motion-api-runtime"
  role   = aws_iam_role.api_lambda.id
  policy = data.aws_iam_policy_document.api_lambda.json
}

resource "aws_iam_role" "cleanup_lambda" {
  name               = "${local.name_prefix}-cleanup-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "cleanup_lambda" {
  statement {
    sid = "WriteLambdaLogs"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${aws_cloudwatch_log_group.cleanup.arn}:*"]
  }

  statement {
    sid       = "ReadDatabaseSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.database.arn]
  }
}

resource "aws_iam_role_policy" "cleanup_lambda" {
  name   = "flow-in-motion-cleanup-runtime"
  role   = aws_iam_role.cleanup_lambda.id
  policy = data.aws_iam_policy_document.cleanup_lambda.json
}

data "aws_iam_policy_document" "scheduler_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values = [
        "arn:${data.aws_partition.current.partition}:scheduler:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:schedule-group/default"
      ]
    }
  }
}

resource "aws_iam_role" "cleanup_scheduler" {
  name               = "${local.name_prefix}-cleanup-scheduler-role"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume_role.json
}

data "aws_iam_policy_document" "cleanup_scheduler" {
  statement {
    sid       = "InvokeCleanupLambda"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.cleanup.arn]
  }

  statement {
    sid       = "SendFailedInvocationToDlq"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.cleanup_dlq.arn]
  }
}

resource "aws_iam_role_policy" "cleanup_scheduler" {
  name   = "flow-in-motion-cleanup-scheduler"
  role   = aws_iam_role.cleanup_scheduler.id
  policy = data.aws_iam_policy_document.cleanup_scheduler.json
}
