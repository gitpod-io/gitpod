variable "project" {
  type = object({
    name = string
  })
}

variable "region" {
  type = string
}

variable "worker_iam_role_name" {
  type = string
}

variable "vpc_id" {
  type = string
}
