data "aws_caller_identity" "current" {}

output "external_dns_settings" {
  value = [
    {
        "name" = "provider",
        "value" = "aws"
    },
    {
        "name" = "aws.region",
        "value" = "eu-west-1"
    },
    {
        "name" = "aws.roleArn",
        "value" = resource.aws_iam_role.gitpod.arn
    }
    ]
}

output "cert_manager_issuer" {
  value = try({
        region = "eu-west-1"
        role   = resource.aws_iam_role.gitpod.arn
        hostedZoneID  = resource.aws_route53_zone.gitpod.zone_id
  }, {})
}

output "domain_nameservers" {
  value = resource.aws_route53_zone.gitpod.name_servers
}
