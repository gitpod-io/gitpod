# User provided zone with Domain configured
# https://www.terraform.io/docs/providers/aws/d/route53_zone.html
data "aws_route53_zone" "zone" {
  name         = var.dns.zone_name
  private_zone = false
}
