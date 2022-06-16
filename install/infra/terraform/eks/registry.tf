resource "aws_ecr_repository" "gitpod" {
  name                 = "registry-${var.cluster_name}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }
}

data "aws_ecr_authorization_token" "gitpod" {
  registry_id = aws_ecr_repository.gitpod.registry_id
}
