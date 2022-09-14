output "external_dns_settings" {
  value = [
    {
      "name"  = "provider",
      "value" = "aws"
    },
    {
      "name"  = "aws.region",
      "value" = var.region
    },
    {
      "name"  = "aws.credentials.secretKey",
      "value" = aws_iam_access_key.edns[0].secret
    },
    {
      "name"  = "aws.credentials.accessKey",
      "value" = aws_iam_access_key.edns[0].id
    }
  ]
}

output "secretAccessKey" {
  sensitive = true
  value     = try("${aws_iam_access_key.edns[0].secret}", "")
}

output "oidc_provider_arn" {
  sensitive = false
  value     = module.eks.oidc_provider_arn
}

output "cluster_id" {
  sensitive = false
  value     = module.eks.cluster_id
}

output "cert_manager_issuer" {
  value = try({
    region = var.region
    secretAccessKeySecretRef = {
      name = "route53-credentials"
      key  = "secret-access-key"
    }

    hostedZoneID = aws_route53_zone.gitpod[0].zone_id
    accessKeyID  = aws_iam_access_key.edns[0].id
  }, {})
}

output "name_servers" {
  value = formatlist("%s.", resource.aws_route53_zone.gitpod[0].name_servers)
}

output "database" {
  sensitive = true
  value = try({
    host     = "${aws_db_instance.gitpod[0].address}"
    username = "${aws_db_instance.gitpod[0].username}"
    password = random_password.password[0].result
    port     = 3306
  }, "No database created")
}

output "registry" {
  sensitive = true
  value = try({
    server   = aws_ecr_repository.gitpod[0].repository_url
    username = data.aws_ecr_authorization_token.gitpod[0].user_name
    password = data.aws_ecr_authorization_token.gitpod[0].password
  }, "No EKS registry created")
}

output "storage" {
  sensitive = true
  value = try({
    region            = aws_s3_bucket.gitpod-storage[0].region
    endpoint          = "s3.${aws_s3_bucket.gitpod-storage[0].region}.amazonaws.com"
    bucket_name       = aws_s3_bucket.gitpod-storage[0].id
    access_key_id     = aws_iam_access_key.bucket_storage_user[0].id
    secret_access_key = aws_iam_access_key.bucket_storage_user[0].secret
  }, "No s3 bucket created for object storage")
}

output "registry_backend" {
  sensitive = true
  value = try({
    region            = aws_s3_bucket.gitpod-registry-backend[0].region
    endpoint          = "s3.${aws_s3_bucket.gitpod-registry-backend[0].region}.amazonaws.com"
    bucket_name       = aws_s3_bucket.gitpod-registry-backend[0].id
    access_key_id     = aws_iam_access_key.bucket_registry_user[0].id
    secret_access_key = aws_iam_access_key.bucket_registry_user[0].secret
  }, "No s3 bucket created for registry backend.")
}
