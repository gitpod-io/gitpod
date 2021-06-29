variable "namespace" {
    type = string
}

# e.g.: gitpod-dev.com
variable "dns_zone_domain" {
    type = string
}

# e.g.: my-branch.staging.gitpod-dev.com
variable "domain" {
    type = string
}

# e.g.: ["", "*.", "*.ws."]
variable "subdomains" {
    type = list(string)
}

variable "public_ip" {
    type = string
}
