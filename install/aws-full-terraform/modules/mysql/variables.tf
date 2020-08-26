variable "project" {
  type = object({
    name = string
  })
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

variable "database" {
  type = object({
    name           = string
    port           = number
    instance_class = string
    engine_version = string
    user_name      = string
    password       = string
  })
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}
