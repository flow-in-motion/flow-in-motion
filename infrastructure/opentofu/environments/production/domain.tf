resource "aws_acm_certificate" "api" {
  domain_name       = local.api_domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "api_certificate_validation" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = one(aws_acm_certificate.api.domain_validation_options).resource_record_name
  type    = one(aws_acm_certificate.api.domain_validation_options).resource_record_type
  ttl     = 60
  records = [
    one(aws_acm_certificate.api.domain_validation_options).resource_record_value,
  ]
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn = aws_acm_certificate.api.arn

  validation_record_fqdns = [
    aws_route53_record.api_certificate_validation.fqdn,
  ]
}

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = local.api_domain_name

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.api.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.default.id
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = local.api_domain_name
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
