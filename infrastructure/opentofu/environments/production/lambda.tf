resource "aws_lambda_function" "api" {
  function_name = local.api_function_name
  description   = "Flow in Motion production NestJS API"
  role          = aws_iam_role.api_lambda.arn

  filename         = var.lambda_package_path
  source_code_hash = filebase64sha256(var.lambda_package_path)

  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "dist/lambda.handler"
  memory_size   = 512
  timeout       = 25

  environment {
    variables = merge(local.common_lambda_environment, {
      DATABASE_SECRET_ARN = aws_secretsmanager_secret.database.arn
    })
  }

  depends_on = [
    aws_cloudwatch_log_group.api,
    aws_iam_role_policy.api_lambda,
  ]
}

resource "aws_lambda_function" "cleanup" {
  function_name = local.cleanup_function_name
  description   = "Flow in Motion production daily archive cleanup"
  role          = aws_iam_role.cleanup_lambda.arn

  filename         = var.lambda_package_path
  source_code_hash = filebase64sha256(var.lambda_package_path)

  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  handler       = "dist/cleanup-lambda.handler"
  memory_size   = 512
  timeout       = 60

  environment {
    variables = merge(local.common_lambda_environment, {
      DATABASE_SECRET_ARN = aws_secretsmanager_secret.database.arn
    })
  }

  depends_on = [
    aws_cloudwatch_log_group.cleanup,
    aws_iam_role_policy.cleanup_lambda,
  ]
}