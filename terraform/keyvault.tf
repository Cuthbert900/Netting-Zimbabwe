data "azurerm_client_config" "current" {}

# Key Vault names must be globally unique across all of Azure, not just
# this subscription — a plain name-prefix collides eventually. This adds
# an 8-hex-char suffix so re-running this module in a second subscription
# (or after a from-scratch destroy/recreate) never fights the first one.
resource "random_id" "kv_suffix" {
  byte_length = 4
}

resource "random_password" "postgres" {
  length  = 32
  special = false # goes straight into a docker-compose env var and a Postgres connection string — keep it URL-safe
}

# GoTrue/PostgREST/Kong all sign and verify JWTs with this shared secret.
# The anon/service_role API keys are themselves JWTs signed with it —
# generated on first boot by files/bootstrap.sh, not by Terraform, since
# minting a signed JWT isn't something the azurerm/random providers do.
resource "random_password" "jwt_secret" {
  length  = 40
  special = false
}

resource "random_password" "dashboard_password" {
  length  = 24
  special = true
}

resource "azurerm_key_vault" "this" {
  name                       = "${substr(replace(local.name_prefix, "-", ""), 0, 15)}${random_id.kv_suffix.hex}"
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  enable_rbac_authorization  = true
  purge_protection_enabled   = true
  soft_delete_retention_days = 30
  tags                       = local.common_tags
}

# The identity running `terraform apply` gets full secret management so you
# can read these back out (`az keyvault secret show`) without SSHing into
# the VM.
resource "azurerm_role_assignment" "operator_secrets" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# The VM reads (but never writes) these at boot via its own managed
# identity — no secrets are embedded in custom_data/cloud-init.
resource "azurerm_role_assignment" "vm_secrets_reader" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_virtual_machine.this.identity[0].principal_id
}

resource "azurerm_key_vault_secret" "postgres_password" {
  name         = "postgres-password"
  value        = random_password.postgres.result
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.operator_secrets]
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = random_password.jwt_secret.result
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.operator_secrets]
}

resource "azurerm_key_vault_secret" "dashboard_username" {
  name         = "dashboard-username"
  value        = "admin"
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.operator_secrets]
}

resource "azurerm_key_vault_secret" "dashboard_password" {
  name         = "dashboard-password"
  value        = random_password.dashboard_password.result
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.operator_secrets]
}

# Filled in by bootstrap.sh on first boot (derived from jwt_secret) so the
# Next.js app's SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY
# can be read from Key Vault instead of copy-pasted off the VM.
resource "azurerm_key_vault_secret" "anon_key_placeholder" {
  name         = "anon-key"
  value        = "pending-first-boot"
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.operator_secrets]

  lifecycle {
    ignore_changes = [value] # bootstrap.sh overwrites this on the VM's first boot
  }
}

resource "azurerm_key_vault_secret" "service_role_key_placeholder" {
  name         = "service-role-key"
  value        = "pending-first-boot"
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.operator_secrets]

  lifecycle {
    ignore_changes = [value]
  }
}
