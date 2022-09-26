resource "aws_s3_bucket" "gitpod-storage" {
  count = var.create_external_storage ? 1 : 0

  force_destroy = true
  bucket        = "bucket-${var.cluster_name}"
}

resource "aws_s3_bucket_acl" "gitpod-storage" {
  count = var.create_external_storage ? 1 : 0

  bucket = aws_s3_bucket.gitpod-storage[count.index].id
  acl    = "private"
}

resource "aws_s3_bucket_versioning" "storage" {
  count = var.create_external_storage ? 1 : 0

  bucket = aws_s3_bucket.gitpod-storage[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_iam_user" "bucket_storage" {
  count = var.create_external_storage ? 1 : 0
  name  = "user-${var.cluster_name}"

}

resource "aws_iam_user_policy_attachment" "full_access_attachment" {
  count      = var.create_external_storage ? 1 : 0
  user       = aws_iam_user.bucket_storage[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_access_key" "bucket_storage_user" {
  count = var.create_external_storage ? 1 : 0
  user  = aws_iam_user.bucket_storage[0].name
}

// s3 bucket for registry backend

resource "aws_s3_bucket" "gitpod-registry-backend" {
  count = var.create_external_storage_for_registry_backend ? 1 : 0

  force_destroy = true
  bucket        = "reg-bucket-${var.cluster_name}"
}

resource "aws_s3_bucket_acl" "gitpod-registry-storage" {
  count = var.create_external_storage_for_registry_backend ? 1 : 0

  bucket = aws_s3_bucket.gitpod-registry-backend[count.index].id
  acl    = "private"
}

resource "aws_s3_bucket_versioning" "registry" {
  count = var.create_external_storage_for_registry_backend ? 1 : 0

  bucket = aws_s3_bucket.gitpod-registry-backend[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_iam_user" "bucket_registry" {
  count = var.create_external_storage_for_registry_backend ? 1 : 0
  name  = "registry-user-${var.cluster_name}"

}

resource "aws_iam_user_policy_attachment" "registry_attachment" {
  count      = var.create_external_storage_for_registry_backend ? 1 : 0
  user       = aws_iam_user.bucket_registry[count.index].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_access_key" "bucket_registry_user" {
  count = var.create_external_storage_for_registry_backend ? 1 : 0
  user  = aws_iam_user.bucket_registry[count.index].name
}
