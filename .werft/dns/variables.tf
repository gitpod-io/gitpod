# e.g.: gitpod-dev.com
variable "dns_zone_domain" {
    type = string
}

# e.g.: my-branch.staging.gitpod-dev.com
variable "domain" {
    type = string
}

# e.g.: ["", "*.", "*.ws-dev."]
variable "ingress_subdomains" {
    type = list(string)
    default = ["", "*."]
}

variable "ws_proxy_subdomain" {
    type = string
    default = "*.ws-dev."
}

variable "ingress_ip" {
    type = string
}

variable "ws_proxy_ip" {
    type = string
}
