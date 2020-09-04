/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

output "external_dns" {
  value = data.kubernetes_service.proxy.load_balancer_ingress.0.hostname
}
