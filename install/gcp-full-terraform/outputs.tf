/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

#
#
#

output "network" {
  value = module.network
}

# output "kubernetes" {
#   value = module.kubernetes
# }

# output "dns" {
#   value = module.dns
# }

# output "storage" {
#   value = yamldecode(module.storage.values)
# }

# output "database" {
#   value = yamldecode(module.database.values)
# }

# output "registry" {
#   value = yamldecode(module.registry.values)
# }

# output "https" {
#   value = module.https
# }
