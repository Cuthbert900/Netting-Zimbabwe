output "vm_public_ip" {
  description = "Public IP of the Supabase VM. Point domain_name's DNS A record at this."
  value       = azurerm_public_ip.this.ip_address
}

output "ssh_command" {
  value = "ssh ${var.admin_username}@${azurerm_public_ip.this.ip_address}"
}

output "key_vault_name" {
  description = "Read secrets with: az keyvault secret show --vault-name <this> --name <secret-name> --query value -o tsv"
  value       = azurerm_key_vault.this.name
}

output "supabase_url" {
  description = "The value for NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL in the app's env once DNS + the first boot have completed."
  value       = local.site_url
}

output "next_steps" {
  value = <<-EOT
    1. If you set domain_name, point its DNS A record at ${azurerm_public_ip.this.ip_address} before boot finishes, so Caddy's Let's Encrypt request succeeds.
    2. Wait a few minutes for cloud-init to finish, then check: ssh ${var.admin_username}@${azurerm_public_ip.this.ip_address} "sudo cloud-init status --wait"
    3. Pull the app-facing secrets out of Key Vault (${azurerm_key_vault.this.name}): anon-key, service-role-key, plus postgres-password and dashboard-username/dashboard-password for Studio.
    4. Set SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in the app's .env.local (or wherever it's deployed) using supabase_url above and the two keys from step 3.
    5. Run supabase/migrations/0001_admin_schema.sql against the new database (via Studio's SQL editor at the supabase_url above, or psql).
    6. Create the first admin: in Studio > Authentication, add a user with your email, then insert a matching row into app_users with role = 'admin'.
  EOT
}
