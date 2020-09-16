variable "do_token" {
  type = string
  description = "Your digital ocean account token"
}

variable "kubernetes_version" {
  type        = string
  description = "The Version of Kubernetes Cluster to create"
}

variable "region" {
  type        = string
  description = "The Region in which to create your resources"
}

variable "cluster_name" {
  type = string
  description = "The desired name of the Kubernetes Cluster"
}

variable "node_count" {
  type = number
  description = "The number of nodes in the node pool"
}

variable "node_size" {
  type = string
  description = "The size of each node in the node pool"
}
