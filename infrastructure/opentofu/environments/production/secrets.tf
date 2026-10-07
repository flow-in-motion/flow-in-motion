resource "aws_secretsmanager_secret" "database" {
  name                    = var.database_secret_name
  description             = "Supabase pooler credentials and server-only API key for Flow in Motion"
  recovery_window_in_days = 7

  lifecycle {
    prevent_destroy = true
  }
}
