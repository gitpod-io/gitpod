locals {
    gke_sa = "gke-sa-${var.cluster_name}"

    obj_sa = "obj-sa-${var.cluster_name}"

    db_sa = "db-sa-${var.cluster_name}"

    dns_sa = "dns-sa-${var.cluster_name}"
}
