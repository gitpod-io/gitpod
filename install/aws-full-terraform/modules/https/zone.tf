/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

# User provided zone with Domain configured
# https://www.terraform.io/docs/providers/aws/d/route53_zone.html
data "aws_route53_zone" "zone" {
  name         = var.dns.zone_name
  private_zone = false
}
