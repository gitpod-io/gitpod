variable "project" {
  type = object({
    name = string
  })
}


variable "worker_iam_role_name" {
  type = string
}

variable "region" {
  type = string
}

variable "gitpod" {
  type = object({
    namespace  = string
    valueFiles = list(string)
  })
  default = {
    namespace  = "default"
    valueFiles = ["./values.yml"]
  }
}