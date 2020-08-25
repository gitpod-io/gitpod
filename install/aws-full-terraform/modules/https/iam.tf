# https://cert-manager.io/docs/configuration/acme/dns01/route53/

#
# AWS IAM role 'dns-manager-role'
#
resource "aws_iam_role" "dns_manager" {
  name = "dns-manager-role-${var.project.name}"

  assume_role_policy = <<-EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "${var.gitpod-node-arn}"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}



#
# AWS IAM role policy 'dns-manager-role-policy'
# allow 'dns-manager-role' to configure Route53 txt records
#
resource "aws_iam_role_policy" "dns_manager" {
  name = "dns-manager-role-policy"

  policy = <<-EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "route53:GetChange",
      "Resource": "arn:aws:route53:::change/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "arn:aws:route53:::hostedzone/*"
    },
    {
      "Effect": "Allow",
      "Action": "route53:ListHostedZonesByName",
      "Resource": "*"
    }
  ]
}
EOF
  role   = aws_iam_role.dns_manager.name
}
