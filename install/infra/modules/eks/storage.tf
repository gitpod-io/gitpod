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

data "aws_iam_policy_document" "s3_policy" {
  count = var.create_external_storage ? 1 : 0
  statement {
    actions   = [
      "s3:PutObject",
      "s3:ListMultipartUploadParts",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload"
    ]
    resources = [aws_s3_bucket.gitpod-storage[count.index].arn]
    effect    = "Allow"
  }
      statement {
    actions   = ["s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:ListBucketMultipartUploads"]
    resources = [aws_s3_bucket.gitpod-storage[count.index].arn]
    effect    = "Allow"
  }
}

resource "aws_iam_policy" "policy" {
  count       = var.create_external_storage ? 1 : 0
  name        = "spolicy-${var.cluster_name}"
  description = "Gitpod ${var.cluster_name} object storage bucket policy"
  policy      = data.aws_iam_policy_document.s3_policy[0].json
}

resource "aws_iam_user" "bucket_storage" {
  count = var.create_external_storage ? 1 : 0
  name  = "suser-${var.cluster_name}"

}

resource "aws_iam_user_policy_attachment" "attachment" {
  count      = var.create_external_storage ? 1 : 0
  user       = aws_iam_user.bucket_storage[0].name
  policy_arn = aws_iam_policy.policy[0].arn
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

data "aws_iam_policy_document" "s3_policy_registry" {
  count = var.create_external_storage_for_registry_backend ? 1 : 0
  statement {
    actions   = [
      "s3:PutObject",
      "s3:ListMultipartUploadParts",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload"
    ]
    resources = [ws_s3_bucket.gitpod-registry-backend[count.index].arn]
    effect    = "Allow"
  }
  statement {
    actions   = ["s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:ListBucketMultipartUploads"]
    resources = [aws_s3_bucket.gitpod-registry-backend[count.index].arn]
    effect    = "Allow"
  }
}

resource "aws_iam_policy" "policy_registry" {
  count       = var.create_external_storage_for_registry_backend ? 1 : 0
  name        = "registry-policy-${var.cluster_name}"
  description = "Gitpod ${var.cluster_name} registry backend storage bucket policy"
  policy      = data.aws_iam_policy_document.s3_policy_registry[count.index].json
}

resource "aws_iam_user" "bucket_registry" {
  count = var.create_external_storage_for_registry_backend ? 1 : 0
  name  = "registry-user-${var.cluster_name}"

}

resource "aws_iam_user_policy_attachment" "registry_attachment" {
  count      = var.create_external_storage_for_registry_backend ? 1 : 0
  user       = aws_iam_user.bucket_registry[count.index].name
  policy_arn = aws_iam_policy.policy_registry[count.index].arn
}

resource "aws_iam_access_key" "bucket_registry_user" {
  count = var.create_external_storage_for_registry_backend ? 1 : 0
  user  = aws_iam_user.bucket_registry[count.index].name
}
