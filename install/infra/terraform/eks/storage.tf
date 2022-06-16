resource "aws_s3_bucket" "gitpod-storage" {
  force_destroy = true
  bucket = "bucket-${var.cluster_name}"
  acl    = "private"

  versioning {
    enabled = true
  }
}

data "aws_iam_policy_document" "s3_policy" {
  statement {
    actions   = ["s3:*"]
    resources = ["*"]
    effect = "Allow"
  }
}

resource "aws_iam_policy" "policy" {
  name        = "spolicy-${var.cluster_name}"
  description = "s3 storage bucket policy"
  policy = data.aws_iam_policy_document.s3_policy.json
}

resource "aws_iam_user" "bucket_storage" {
  name = "suser-${var.cluster_name}"

}

resource "aws_iam_user_policy_attachment" "attachment" {
  user       = aws_iam_user.bucket_storage.name
  policy_arn = aws_iam_policy.policy.arn
}

resource "aws_iam_access_key" "bucket_storage_user" {
  user = aws_iam_user.bucket_storage.name
}
