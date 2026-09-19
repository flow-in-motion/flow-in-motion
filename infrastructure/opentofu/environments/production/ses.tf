resource "aws_sesv2_configuration_set" "transactional" {
  configuration_set_name = "${local.name_prefix}-transactional"

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }

  suppression_options {
    suppressed_reasons = [
      "BOUNCE",
      "COMPLAINT",
    ]
  }
}

resource "aws_sesv2_email_identity" "domain" {
  email_identity         = var.domain_name
  configuration_set_name = aws_sesv2_configuration_set.transactional.configuration_set_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_route53_record" "ses_dkim" {
  for_each = {
    first  = 0
    second = 1
    third  = 2
  }

  zone_id = data.aws_route53_zone.primary.zone_id
  name = format(
    "%s._domainkey.%s",
    aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[each.value],
    var.domain_name,
  )
  type = "CNAME"
  ttl  = 1800
  records = [
    format(
      "%s.dkim.amazonses.com",
      aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[each.value],
    ),
  ]
}

resource "aws_route53_record" "spf" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 300
  records = ["\"v=spf1 include:amazonses.com ~all\""]
}

resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=none;"]
}