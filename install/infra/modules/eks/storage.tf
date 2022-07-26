resource "aws_s3_bucket" "gitpod-storage" {
  count = var.enable_external_storage ? 1 : 0

  force_destroy = true
  bucket        = "bucket-${var.cluster_name}"
  acl           = "private"

  versioning {
    enabled = true
  }
}

data "aws_iam_policy_document" "s3_policy" {
  count = var.enable_external_storage ? 1 : 0
  statement {
    actions   = ["s3:*"]
    resources = ["*"]
    effect    = "Allow"
  }
}

resource "aws_iam_policy" "policy" {
  count       = var.enable_external_storage ? 1 : 0
  name        = "spolicy-${var.cluster_name}"
  description = "s3 storage bucket policy"
  policy      = data.aws_iam_policy_document.s3_policy[0].json
}

resource "aws_iam_user" "bucket_storage" {
  count = var.enable_external_storage ? 1 : 0
  name  = "suser-${var.cluster_name}"

}

resource "aws_iam_user_policy_attachment" "attachment" {
  count      = var.enable_external_storage ? 1 : 0
  user       = aws_iam_user.bucket_storage[0].name
  policy_arn = aws_iam_policy.policy[0].arn
}

resource "aws_iam_access_key" "bucket_storage_user" {
  count = var.enable_external_storage ? 1 : 0
  user  = aws_iam_user.bucket_storage[0].name
}
