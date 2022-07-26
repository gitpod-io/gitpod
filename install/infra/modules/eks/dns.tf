resource "aws_route53_zone" "gitpod" {
  force_destroy = true
  name = var.domain_name

  tags = {
    Environment = "test"
  }
}

# This creates an SSL certificate
resource "aws_acm_certificate" "gitpod" {
  domain_name       = var.domain_name
  subject_alternative_names = ["*.ws.${var.domain_name}", "ws.${var.domain_name}", "*.${var.domain_name}"]
  validation_method = "DNS"
}

# This is a DNS record for the ACM certificate validation to prove we own the domain
#
# This example, we make an assumption that the certificate is for a single domain name so can just use the first value of the
# domain_validation_options.  It allows the terraform to apply without having to be targeted.
# This is somewhat less complex than the example at https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/acm_certificate_validation
# - that above example, won't apply without targeting

resource "aws_route53_record" "cert_validation" {
  allow_overwrite = true
  name = tolist(aws_acm_certificate.gitpod.domain_validation_options)[0].resource_record_name
  type = tolist(aws_acm_certificate.gitpod.domain_validation_options)[0].resource_record_type
  zone_id = "${resource.aws_route53_zone.gitpod.zone_id}"
  records = [tolist(aws_acm_certificate.gitpod.domain_validation_options)[0].resource_record_value]
  ttl = 60
}

resource "aws_route53_record" "cert_validation_1" {
  allow_overwrite = true
  name = tolist(aws_acm_certificate.gitpod.domain_validation_options)[1].resource_record_name
  type = tolist(aws_acm_certificate.gitpod.domain_validation_options)[1].resource_record_type
  zone_id = "${resource.aws_route53_zone.gitpod.zone_id}"
  records = [tolist(aws_acm_certificate.gitpod.domain_validation_options)[1].resource_record_value]
  ttl = 60
}

resource "aws_route53_record" "cert_validation_2" {
  allow_overwrite = true
  name = tolist(aws_acm_certificate.gitpod.domain_validation_options)[2].resource_record_name
  type = tolist(aws_acm_certificate.gitpod.domain_validation_options)[2].resource_record_type
  zone_id = "${resource.aws_route53_zone.gitpod.zone_id}"
  records = [tolist(aws_acm_certificate.gitpod.domain_validation_options)[2].resource_record_value]
  ttl = 60
}

resource "aws_route53_record" "cert_validation_3" {
  allow_overwrite = true
  name = tolist(aws_acm_certificate.gitpod.domain_validation_options)[3].resource_record_name
  type = tolist(aws_acm_certificate.gitpod.domain_validation_options)[3].resource_record_type
  zone_id = "${resource.aws_route53_zone.gitpod.zone_id}"
  records = [tolist(aws_acm_certificate.gitpod.domain_validation_options)[3].resource_record_value]
  ttl = 60
}

resource "aws_iam_policy" "gitpod" {
  name = "role-${var.cluster_name}"

  # Terraform's "jsonencode" function converts a
  # Terraform expression result to valid JSON syntax.
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
        {
            Effect = "Allow",
            Action = [
                "route53:ChangeResourceRecordSets"
            ],
            Resource = [
                "arn:aws:route53:::hostedzone/*"
            ]
        },
        {
            Effect = "Allow",
            Action = [
                "route53:GetChange",
            ],
            Resource = [
                "arn:aws:route53:::change/*"
            ]
        },
        {
            Effect = "Allow",
            Action = [
                "route53:ListHostedZones",
                "route53:ListResourceRecordSets"
            ],
            Resource = [ "*" ]
        }
    ],
  })
}

resource "aws_iam_user_policy_attachment" "test-attach" {
  user       = aws_iam_user.edns.name
  policy_arn = aws_iam_policy.gitpod.arn
}

resource "aws_iam_user" "edns" {
  name = "${var.cluster_name}-external-dns"
  force_destroy = true

  tags = {
    env = "test"
  }
}

resource "aws_iam_access_key" "edns" {
  user = aws_iam_user.edns.name
}
