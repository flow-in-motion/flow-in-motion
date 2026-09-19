provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "flow-in-motion"
      Environment = var.environment
      ManagedBy   = "opentofu"
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_region" "current" {}