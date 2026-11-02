locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge({
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }, var.tags)
  site_url = var.domain_name != "" ? "https://${var.domain_name}" : "http://${azurerm_public_ip.this.ip_address}:8000"
}

resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags
}

# ---- Networking -------------------------------------------------------

resource "azurerm_virtual_network" "this" {
  name                = "${local.name_prefix}-vnet"
  address_space       = ["10.42.0.0/16"]
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  tags                = local.common_tags
}

resource "azurerm_subnet" "this" {
  name                 = "${local.name_prefix}-subnet"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = ["10.42.1.0/24"]
}

resource "azurerm_public_ip" "this" {
  name                = "${local.name_prefix}-pip"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.common_tags
}

# Inbound: SSH + the Studio dashboard restricted to admin CIDRs; 80/443 open
# to the world since that's the whole point of a reverse-proxied API/auth
# gateway. Nothing else — Postgres (5432) never leaves the VM's docker
# network, and the individual Supabase services (auth, rest, meta) are only
# reachable through Kong.
resource "azurerm_network_security_group" "this" {
  name                = "${local.name_prefix}-nsg"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  tags                = local.common_tags

  security_rule {
    name                       = "AllowSSHFromAdmin"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefixes    = var.allowed_admin_cidrs
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowStudioFromAdmin"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8000"
    source_address_prefixes    = var.allowed_admin_cidrs
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowHTTP"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 130
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "this" {
  name                = "${local.name_prefix}-nic"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  tags                = local.common_tags

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.this.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.this.id
  }
}

resource "azurerm_network_interface_security_group_association" "this" {
  network_interface_id     = azurerm_network_interface.this.id
  network_security_group_id = azurerm_network_security_group.this.id
}

# ---- Storage ------------------------------------------------------------

resource "azurerm_managed_disk" "postgres_data" {
  name                 = "${local.name_prefix}-pgdata"
  location             = azurerm_resource_group.this.location
  resource_group_name  = azurerm_resource_group.this.name
  storage_account_type = "Premium_LRS"
  create_option        = "Empty"
  disk_size_gb         = var.data_disk_size_gb
  tags                 = local.common_tags
}

# ---- VM -------------------------------------------------------------------

resource "azurerm_linux_virtual_machine" "this" {
  name                = "${local.name_prefix}-vm"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  size                = var.vm_size
  admin_username      = var.admin_username
  network_interface_ids = [azurerm_network_interface.this.id]
  tags                = local.common_tags

  # System-assigned managed identity — used by the bootstrap script on the
  # VM to pull the generated secrets out of Key Vault instead of having
  # Terraform bake them into custom_data (which lands in VM instance
  # metadata logs).
  identity {
    type = "SystemAssigned"
  }

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.admin_ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb          = var.os_disk_size_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(templatefile("${path.module}/cloud-init.tpl.yaml", {
    docker_compose_b64 = base64encode(file("${path.module}/files/docker-compose.yml"))
    kong_config_b64     = base64encode(file("${path.module}/files/kong.yml"))
    bootstrap_sh_b64     = base64encode(templatefile("${path.module}/files/bootstrap.sh.tpl", {
      key_vault_name = azurerm_key_vault.this.name
      site_url       = local.site_url
    }))
    caddyfile_b64        = base64encode(templatefile("${path.module}/files/Caddyfile.tpl", {
      domain_name       = var.domain_name != "" ? var.domain_name : ":8000"
      letsencrypt_email = var.letsencrypt_email
    }))
  }))

  disable_password_authentication = true
}

resource "azurerm_virtual_machine_data_disk_attachment" "postgres_data" {
  managed_disk_id    = azurerm_managed_disk.postgres_data.id
  virtual_machine_id = azurerm_linux_virtual_machine.this.id
  lun                = 10
  caching            = "ReadWrite"
}
