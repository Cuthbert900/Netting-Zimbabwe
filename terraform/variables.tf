variable "project_name" {
  description = "Short name used as a prefix for every resource this module creates."
  type        = string
  default     = "netting-supabase"
}

variable "environment" {
  description = "Environment tag (e.g. production, staging). Kept out of the resource name so a rename doesn't force a recreate."
  type        = string
  default     = "production"
}

variable "location" {
  description = "Azure region. Pick one close to Harare / the Liquid Zimbabwe estate with good latency — South Africa North is the usual default for this tenant."
  type        = string
  default     = "South Africa North"
}

variable "resource_group_name" {
  description = "Name of the resource group to create. Leave the default unless it collides with something in the tenant."
  type        = string
  default     = "rg-netting-supabase"
}

variable "vm_size" {
  description = "VM size. Supabase's own self-host docs call for at least 2 vCPU / 4GB RAM; Standard_B2ms (2 vCPU / 8GB) gives real headroom for Postgres + Kong + GoTrue + PostgREST + Studio running together."
  type        = string
  default     = "Standard_B2ms"
}

variable "os_disk_size_gb" {
  description = "OS disk size in GB."
  type        = number
  default     = 64
}

variable "data_disk_size_gb" {
  description = "Size of the separate managed disk Postgres's data directory is mounted on, in GB. Sized independently of the OS disk so growing the database doesn't mean resizing the OS volume."
  type        = number
  default     = 128
}

variable "admin_username" {
  description = "SSH admin username on the VM."
  type        = string
  default     = "supabaseadmin"
}

variable "admin_ssh_public_key" {
  description = "Your SSH public key (contents of e.g. ~/.ssh/id_ed25519.pub). Required — this is how you'll reach the VM to check on it; there is no password login."
  type        = string
}

variable "allowed_admin_cidrs" {
  description = "CIDR blocks allowed to reach SSH (22) and the Supabase Studio dashboard (8000, if you choose to expose it directly rather than through Caddy). Keep this to your office/VPN egress IP(s) — never 0.0.0.0/0."
  type        = list(string)
}

variable "domain_name" {
  description = "Public DNS name the Supabase stack will be reachable at (e.g. supabase-recon.libertyzim.example). If set, Caddy requests a Let's Encrypt certificate for it automatically and terminates TLS on 443. If left empty, the stack is only reachable over plain HTTP on port 8000 from allowed_admin_cidrs — fine for a first boot/smoke test, not for production."
  type        = string
  default     = ""
}

variable "letsencrypt_email" {
  description = "Email Let's Encrypt should associate with the certificate (renewal notices only). Required if domain_name is set."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}
