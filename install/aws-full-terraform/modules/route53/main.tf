### Domain Configuration ###

locals {
  paths = [var.dns.domain, "*.${var.dns.domain}", "*.ws.${var.dns.domain}"]
}

# https://www.terraform.io/docs/providers/aws/d/elb_hosted_zone_id.html
data "aws_elb_hosted_zone_id" "main" {}

# https://www.terraform.io/docs/providers/aws/r/route53_record.html
resource "aws_route53_record" "root_record" {
  count   = length(local.paths)
  zone_id = data.aws_route53_zone.zone.zone_id
  type    = "A"
  name    = local.paths[count.index]

  alias {
    name                   = var.external_dns
    zone_id                = data.aws_elb_hosted_zone_id.main.id
    evaluate_target_health = false
  }

  lifecycle {
    create_before_destroy = true
  }
}

# User provided zone with Domain configured
# https://www.terraform.io/docs/providers/aws/d/route53_zone.html
data "aws_route53_zone" "zone" {
  name         = var.dns.zone_name
  private_zone = false
}
