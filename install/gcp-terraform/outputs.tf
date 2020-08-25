/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */


output "public_ip" {
  value = module.network.static_ip
}

output "cluster_name" {
  value = module.kubernetes.cluster.name
}
