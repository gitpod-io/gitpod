variable "dns" {
  type = object({
    domain    = string
    zone_name = string
  })
}

variable "external_dns" {
  type = string
}
