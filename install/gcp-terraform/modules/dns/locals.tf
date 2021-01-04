/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

locals {
  hostname = trimsuffix("${var.subdomain}.${data.google_dns_managed_zone.gitpod.dns_name}", ".")
}