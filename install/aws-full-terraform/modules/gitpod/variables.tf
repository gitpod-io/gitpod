variable "gitpod" {
  type = object({
    valueFiles = list(string)
    namespace  = string
  })
  default = {
    valueFiles = ["./values.yml"]
    namespace  = "default"
  }
}

variable "helm" {
  type = object({
    repository = string
    chart      = string
  })
  default = {
    repository = "https://charts.gitpod.io"
    chart      = "gitpod"
  }
}

variable "domain_name" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "auth_providers" {
  type = list(
    object({
      id            = string
      host          = string
      client_id     = string
      client_secret = string
      settings_url  = string
      callback_url  = string
      protocol      = string
      type          = string
    })
  )
}

variable "values" {
  type = list(string)
}