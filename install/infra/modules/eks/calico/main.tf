
variable "kubeconfig" {
  description = "Path to the KUBECONFIG file to connect to the cluster"
  default     = "./kubeconfig"
}

# delete aws-node daemonset
resource "null_resource" "delete-aws-node" {
  provisioner "local-exec" {
    command = "kubectl -n kube-system delete daemonset/aws-node"
  }
}

# install calico
provider "helm" {
  kubernetes {
    config_path = var.kubeconfig
  }
}

resource "helm_release" "calico" {
  name             = "tigera-operator"
  repository       = "https://projectcalico.docs.tigera.io/charts"
  chart            = "tigera-operator"
  namespace        = "tigera-operator"
  version          = "v3.24.1"
  create_namespace = true
}

# add nodes
module "eks_managed_node_group" {
  source = "terraform-aws-modules/eks/aws//modules/eks-managed-node-group"

  enable_bootstrap_user_data = true
  instance_types             = [var.service_machine_type]
  name                       = "service-${var.cluster_name}"
  iam_role_name              = format("%s-%s", substr("${var.cluster_name}-svc-ng", 0, 58), random_string.ng_role_suffix.result)
  subnet_ids                 = module.vpc.public_subnets
  min_size                   = 1
  max_size                   = 4
  desired_size               = 2
  block_device_mappings = [{
    device_name = "/dev/sda1"

    ebs = [{
      volume_size           = 300
      volume_type           = "gp3"
      throughput            = 500
      iops                  = 6000
      delete_on_termination = true
    }]
  }]
  labels = {
    "gitpod.io/workload_meta"               = true
    "gitpod.io/workload_ide"                = true
    "gitpod.io/workload_workspace_services" = true
  }

  tags = {
    "k8s.io/cluster-autoscaler/enabled" = true
    "k8s.io/cluster-autoscaler/gitpod"  = "owned"
  }

  pre_bootstrap_user_data = <<-EOT
        #!/bin/bash
        set -ex
        cat <<-EOF > /etc/profile.d/bootstrap.sh
        export CONTAINER_RUNTIME="containerd"
        export USE_MAX_PODS=false
        EOF
        # Source extra environment variables in bootstrap script
        sed -i '/^set -o errexit/a\\nsource /etc/profile.d/bootstrap.sh' /etc/eks/bootstrap.sh
        EOT
}
