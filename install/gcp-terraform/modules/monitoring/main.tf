/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
# Enable Service APIs
#

# # https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_project_service
# resource "google_project_service" "gitpod_monitoring" {
#   count   = length(local.google_services)
#   project = var.project
#   service = local.google_services[count.index]

#   disable_dependent_services = false
# }
