# kubelet-config-fix

This container sets `--serialize-image-pulls` in the [kubelet config](https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/) and restarts the kubelet unit. This allows kubelet to pull images in parallel.

The reason for this hack is that GCP does not allow to configure kubelet officially. To activate this hack, you need to set the following in your `values.yaml` file of your helm deployment:

```
components:
  wsDaemon:
    kubeletConfigFix:
      enabled: true
```


## Background

On GCP, the file `/etc/default/kubelet` looks like this:
```
KUBELET_OPTS="--v=2 --cloud-provider=gce --experimental-check-node-capabilities-before-mount=true --experimental-mounter-path=/home/kubernetes/containerized_mounter/mounter --cert-dir=/var/lib/kubelet/pki/ --cni-bin-dir=/home/kubernetes/bin --kubeconfig=/var/lib/kubelet/kubeconfig --image-pull-progress-deadline=5m --experimental-kernel-memcg-notification=true --max-pods=110 --non-masquerade-cidr=0.0.0.0/0 --network-plugin=cni --node-labels=cloud.google.com/gke-local-ssd=true,cloud.google.com/gke-nodepool=workspace-pool,cloud.google.com/gke-os-distribution=ubuntu,cloud.google.com/machine-family=n2,gitpod.io/workload_workspace=true,node.kubernetes.io/masq-agent-ds-ready=true,projectcalico.org/ds-ready=true --volume-plugin-dir=/home/kubernetes/flexvolume --bootstrap-kubeconfig=/var/lib/kubelet/bootstrap-kubeconfig --node-status-max-images=25 --container-runtime=remote --container-runtime-endpoint=unix:///run/containerd/containerd.sock --runtime-cgroups=/system.slice/containerd.service --registry-qps=10 --registry-burst=20 --config /home/kubernetes/kubelet-config.yaml --pod-sysctls='net.core.somaxconn=1024,net.ipv4.conf.all.accept_redirects=0,net.ipv4.conf.all.forwarding=1,net.ipv4.conf.all.route_localnet=1,net.ipv4.conf.default.forwarding=1,net.ipv4.ip_forward=1,net.ipv4.tcp_fin_timeout=60,net.ipv4.tcp_keepalive_intvl=75,net.ipv4.tcp_keepalive_probes=9,net.ipv4.tcp_keepalive_time=7200,net.ipv4.tcp_rmem=4096 87380 6291456,net.ipv4.tcp_syn_retries=6,net.ipv4.tcp_tw_reuse=0,net.ipv4.tcp_wmem=4096 16384 4194304,net.ipv4.udp_rmem_min=4096,net.ipv4.udp_wmem_min=4096,net.ipv6.conf.default.accept_ra=0,net.netfilter.nf_conntrack_generic_timeout=600,net.netfilter.nf_conntrack_tcp_be_liberal=1,net.netfilter.nf_conntrack_tcp_timeout_close_wait=3600,net.netfilter.nf_conntrack_tcp_timeout_established=86400'"
KUBE_COVERAGE_FILE="/var/log/kubelet.cov"
```

This tool adds `--serialize-image-pulls=false` to the `KUBELET_OPTS`.
