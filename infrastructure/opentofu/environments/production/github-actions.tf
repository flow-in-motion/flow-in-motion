data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = [
    data.tls_certificate.github_actions.certificates[
      length(data.tls_certificate.github_actions.certificates) - 1
    ].sha1_fingerprint,
  ]
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type = "Federated"
      identifiers = [
        aws_iam_openid_connect_provider.github_actions.arn,
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${split("/", var.github_repository)[0]}@${var.github_organization_id}/${split("/", var.github_repository)[1]}@${var.github_repository_id}:ref:refs/heads/${var.github_deployment_branch}",
      ]
    }
  }
}

resource "aws_iam_role" "github_deployment" {
  name                 = "${local.name_prefix}-github-deployment-role"
  description          = "GitHub Actions OpenTofu deployment role for Flow in Motion"
  max_session_duration = 3600
  assume_role_policy   = data.aws_iam_policy_document.github_actions_assume_role.json
}

data "aws_iam_policy_document" "github_deployment" {
  statement {
    sid = "ManageApplicationInfrastructure"

    actions = [
      "acm:*",
      "apigateway:*",
      "budgets:*",
      "cloudwatch:*",
      "lambda:*",
      "logs:*",
      "scheduler:*",
      "ses:*",
      "sns:*",
      "sqs:*",
    ]

    resources = ["*"]
  }

  statement {
    sid = "ManageApplicationRoles"

    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:PassRole",
    ]

    resources = [
      "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:role/flow-in-motion-*",
    ]
  }

  statement {
    sid = "ReadGitHubOidcProvider"

    actions = [
      "iam:GetOpenIDConnectProvider",
      "iam:ListOpenIDConnectProviders",
    ]

    resources = ["*"]
  }

  statement {
    sid = "ManageApplicationDns"

    actions = [
      "route53:ChangeResourceRecordSets",
      "route53:GetHostedZone",
      "route53:ListResourceRecordSets",
    ]

    resources = [data.aws_route53_zone.primary.arn]
  }

  statement {
    sid = "ReadRoute53"

    actions = [
      "route53:GetChange",
      "route53:ListHostedZones",
      "route53:ListHostedZonesByName",
    ]

    resources = ["*"]
  }

  statement {
    sid = "ManageDatabaseSecretMetadata"

    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:TagResource",
      "secretsmanager:UntagResource",
      "secretsmanager:UpdateSecret",
    ]

    resources = [aws_secretsmanager_secret.database.arn]
  }

  statement {
    sid = "ListStateBucket"

    actions = ["s3:ListBucket"]

    resources = [
      "arn:${data.aws_partition.current.partition}:s3:::${local.state_bucket_name}",
    ]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["${local.state_key}*"]
    }
  }

  statement {
    sid = "ManageStateObjects"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = [
      "arn:${data.aws_partition.current.partition}:s3:::${local.state_bucket_name}/${local.state_key}*",
    ]
  }
}

resource "aws_iam_role_policy" "github_deployment" {
  name   = "flow-in-motion-opentofu-deployment"
  role   = aws_iam_role.github_deployment.id
  policy = data.aws_iam_policy_document.github_deployment.json
}
