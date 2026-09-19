resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.name_prefix}-http-api"
  retention_in_days = 14
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${local.name_prefix}-http-api"
  protocol_type = "HTTP"
  description   = "Flow in Motion production HTTP API"

  cors_configuration {
    allow_origins = local.cors_allowed_origins
    allow_headers = [
      "Authorization",
      "Content-Type",
    ]
    allow_methods = [
      "GET",
      "HEAD",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS",
    ]
    max_age = 3600
  }
}

resource "aws_apigatewayv2_integration" "api_lambda" {
  api_id = aws_apigatewayv2_api.api.id

  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

resource "aws_apigatewayv2_route" "default" {
  api_id = aws_apigatewayv2_api.api.id

  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.api.id

  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn

    format = jsonencode({
      requestId      = "$context.requestId"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      integrationErr = "$context.integrationErrorMessage"
      sourceIp       = "$context.identity.sourceIp"
    })
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
