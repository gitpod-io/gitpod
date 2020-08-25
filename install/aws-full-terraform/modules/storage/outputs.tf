output "secret_key" {
  value = aws_iam_access_key.gitpod_storage.secret
}

output "access_key" {
  value = aws_iam_access_key.gitpod_storage.id
}

output "endpoint" {
  value = "${aws_s3_access_point.gitpod_storage.account_id}.s3-control.${var.region}.amazonaws.com"
}

output "values" {
  value = data.template_file.gitpod_storage.rendered
}
