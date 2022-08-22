 locals {
   aws_cert_manager_enabled = local.domain_name_enabled && var.use_aws_cert_manager == true
   aws_cert_manager_count   = local.aws_cert_manager_enabled ? 1 : 0
   domain_name_enabled      = var.domain_name != ""
   domain_name_count        = local.domain_name_enabled ? 1 : 0
 }
