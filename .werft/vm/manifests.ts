type NamespaceManifestOptions = {
  namespace: string
}

export function NamespaceManifest({ namespace }: NamespaceManifestOptions) {
  return `
apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
`
}

type VirtualMachineManifestArguments = {
  vmName: string
  namespace: string
  claimName: string
  userDataSecretName: string
}

export function VirtualMachineManifest({ vmName, namespace, claimName, userDataSecretName }: VirtualMachineManifestArguments) {
  return `
apiVersion: kubevirt.io/v1
type: kubevirt.io.virtualmachine
kind: VirtualMachine
metadata:
  namespace: ${namespace}
  annotations:
    harvesterhci.io/volumeClaimTemplates: '[{"metadata":{"name":"${claimName}","annotations":{"harvesterhci.io/imageId":"default/image-vz76n"}},"spec":{"accessModes":["ReadWriteMany"],"resources":{"requests":{"storage":"100Gi"}},"volumeMode":"Block","storageClassName":"longhorn-image-vz76n"}}]'
    network.harvesterhci.io/ips: "[]"
  labels:
    harvesterhci.io/creator: harvester
    harvesterhci.io/os: ubuntu
  name: ${vmName}
spec:
  running: true
  template:
    metadata:
      annotations:
        harvesterhci.io/sshNames: "[]"
      labels:
        harvesterhci.io/vmName: ${vmName}
    spec:
      readinessProbe:
        tcpSocket:
          port: 2200
        initialDelaySeconds: 120
        periodSeconds: 20
        timeoutSeconds: 10
        failureThreshold: 10
        successThreshold: 10
      domain:
        hostname: ${vmName}
        machine:
          type: q35
        cpu:
          cores: 6
          sockets: 1
          threads: 1
        devices:
          interfaces:
            - masquerade: {}
              model: virtio
              name: default
          disks:
            - name: system
              bootOrder: 1
              disk:
                bus: scsi
            - name: cloudinitdisk
              disk:
                bus: virtio
        resources:
          limits:
            memory: 12Gi
            cpu: 6
      evictionStrategy: LiveMigrate
      networks:
        - pod: {}
          name: default
      volumes:
        - name: system
          persistentVolumeClaim:
            claimName: ${claimName}
        - name: cloudinitdisk
          cloudInitNoCloud:
            networkDataSecretRef:
              name: ${userDataSecretName}
            secretRef:
              name: ${userDataSecretName}

`
}

type ServiceManifestOptions = {
  vmName: string
  namespace: string
}

export function ServiceManifest({ vmName, namespace }: ServiceManifestOptions) {
  return `
apiVersion: v1
kind: Service
metadata:
  name: proxy
  namespace: ${namespace}
spec:
  ports:
    - name: ssh-gateway
      protocol: TCP
      port: 22
      targetPort: 22
    - name: vm-ssh
      protocol: TCP
      port: 2200
      targetPort: 2200
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
    - name: https
      protocol: TCP
      port: 443
      targetPort: 443
    - name: kube-api
      protocol: TCP
      port: 6443
      targetPort: 6443
    - name: prometheus
      protocol: TCP
      port: 9090
      targetPort: 32001
    - name: grafana
      protocol: TCP
      port: 3000
      targetPort: 32000
  selector:
    harvesterhci.io/vmName: ${vmName}
  type: ClusterIP
`
}

type UserDataSecretManifestOptions = {
  vmName: string
  namespace: string,
  secretName: string
}

export function UserDataSecretManifest({vmName, namespace, secretName }: UserDataSecretManifestOptions) {
  const userdata = Buffer.from(`#cloud-config
users:
- name: ubuntu
  sudo: "ALL=(ALL) NOPASSWD: ALL"
  ssh_authorized_keys:
    - ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC/aB/HYsb56V0NBOEab6j33v3LIxRiGqG4fmidAryAXevLyTANJPF8m44KSzSQg7AI7PMy6egxQp/JqH2b+3z1cItWuHZSU+klsKNuf5HxK7AOrND3ahbejZfyYewtKFQ3X9rv5Sk8TAR5gw5oPbkTR61jiLa58Sw7UkhLm2EDguGASb6mBal8iboiF8Wpl8QIvPmJaGIOY2YwXLepwFA3S3kVqW88eh2WFmjTMre5ASLguYNkHXjyb/TuhVFzAvphzpl84RAaEyjKYnk45fh4xRXx+oKqlfKRJJ/Owxa7SmGO+/4rWb3chdnpodHeu7XjERmjYLY+r46sf6n6ySgEht1xAWjMb1uqZqkDx+fDDsjFSeaN3ncX6HSoDOrphFmXYSwaMpZ8v67A791fuUPrMLC+YMckhTuX2g4i3XUdumIWvhaMvKhy/JRRMsfUH0h+KAkBLI6tn5ozoXiQhgM4SAE5HsMr6CydSIzab0yY3sq0avmZgeoc78+8PKPkZG1zRMEspV/hKKBC8hq7nm0bu4IgzuEIYHowOD8svqA0ufhDWxTt6A4Jo0xDzhFyKme7KfmW7SIhpejf3T1Wlf+QINs1hURr8LSOZEyY2SzYmAoQ49N0SSPb5xyG44cptpKcj0WCAJjBJoZqz0F5x9TjJ8XToB5obyJfRHD1JjxoMQ== dev@gitpod.io
chpasswd:
  list: |
    ubuntu:ubuntu
  expire: False
write_files:
  - path: /etc/ssh/sshd_config.d/101-change-ssh-port.conf
    permission: 0644
    owner: root
    content: 'Port 2200'
  - path: /usr/local/bin/bootstrap-k3s.sh
    permissions: 0744
    owner: root
    content: |
      #!/bin/bash

      set -eo pipefail

      # inspired by https://github.com/gitpod-io/ops/blob/main/deploy/workspace/templates/bootstrap.sh

      # Install k3s
      export INSTALL_K3S_SKIP_DOWNLOAD=true

      /usr/local/bin/install-k3s.sh \\
          --token "1234" \\
          --node-ip "$(hostname -I | cut -d ' ' -f1)" \\
          --node-label "cloud.google.com/gke-nodepool=control-plane-pool" \\
          --container-runtime-endpoint=/var/run/containerd/containerd.sock \\
          --write-kubeconfig-mode 444 \\
          --disable traefik \\
          --disable metrics-server \\
          --flannel-backend=none \\
          --kubelet-arg config=/etc/kubernetes/kubelet-config.json \\
          --kubelet-arg feature-gates=LocalStorageCapacityIsolation=true \\
          --kubelet-arg feature-gates=LocalStorageCapacityIsolationFSQuotaMonitoring=true \\
          --kube-apiserver-arg feature-gates=LocalStorageCapacityIsolation=true \\
          --kube-apiserver-arg feature-gates=LocalStorageCapacityIsolationFSQuotaMonitoring=true \\
          --cluster-init

      kubectl label nodes ${vmName} \\
          gitpod.io/workload_meta=true \\
          gitpod.io/workload_ide=true \\
          gitpod.io/workload_workspace_services=true \\
          gitpod.io/workload_workspace_regular=true \\
          gitpod.io/workload_workspace_headless=true \\
          gitpod.io/workspace_0=true \\
          gitpod.io/workspace_1=true \\
          gitpod.io/workspace_2=true

      # apply fix from https://github.com/k3s-io/klipper-lb/issues/6 so we can use the klipper servicelb
      # this can be removed if https://github.com/gitpod-io/gitpod-packer-gcp-image/pull/20 gets merged
      cat /var/lib/gitpod/manifests/calico.yaml | sed s/__KUBERNETES_NODE_NAME__\\"\\,/__KUBERNETES_NODE_NAME__\\",\\ \\"container_settings\\"\\:\\ \\{\\ \\"allow_ip_forwarding\\"\\:\\ true\\ \\}\\,/ > /var/lib/gitpod/manifests/calico2.yaml
      kubectl apply -f /var/lib/gitpod/manifests/calico2.yaml

      kubectl apply -f /var/lib/gitpod/manifests/cert-manager.yaml
      kubectl apply -f /var/lib/gitpod/manifests/metrics-server.yaml

      cat <<EOF >> /etc/bash.bashrc
      export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
      EOF
runcmd:
 - bash /usr/local/bin/bootstrap-k3s.sh`).toString("base64")
  return `
apiVersion: v1
type: secret
kind: Secret
data:
  networkdata: ""
  userdata: ${userdata}
metadata:
  name: ${secretName}
  namespace: ${namespace}
`
}
