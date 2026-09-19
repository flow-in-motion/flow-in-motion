resource "aws_secretsmanager_secret" "database" {
  name                    = var.database_secret_name
  description             = "Supabase transaction-pooler credentials for the Flow in Motion API"
  recovery_window_in_days = 7

  lifecycle {
    prevent_destroy = true
  }
}