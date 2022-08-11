resource "aws_ecr_repository" "gitpod" {
  count = var.create_external_registry ? 1 : 0

  name                 = "registry-${var.cluster_name}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }
}

data "aws_ecr_authorization_token" "gitpod" {
  count       = var.create_external_registry ? 1 : 0
  registry_id = aws_ecr_repository.gitpod[0].registry_id
}
