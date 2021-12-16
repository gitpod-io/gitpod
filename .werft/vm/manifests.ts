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
  claimName: string,
}

export function VirtualMachineManifest({ vmName, namespace, claimName }: VirtualMachineManifestArguments) {
  return `
apiVersion: kubevirt.io/v1
type: kubevirt.io.virtualmachine
kind: VirtualMachine
metadata:
  namespace: ${namespace}
  annotations:
    harvesterhci.io/volumeClaimTemplates: '[{"metadata":{"name":"${claimName}","annotations":{"harvesterhci.io/imageId":"default/image-cjlm2"}},"spec":{"accessModes":["ReadWriteMany"],"resources":{"requests":{"storage":"10Gi"}},"volumeMode":"Block","storageClassName":"longhorn-image-cjlm2"}}]'
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
      domain:
        hostname: ${vmName}
        machine:
          type: q35
        cpu:
          cores: 4
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
                bus: virtio
            - name: cloudinitdisk
              disk:
                bus: virtio
        resources:
          limits:
            memory: 8Gi
            cpu: 4
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
            userData: |-
              #cloud-config
              users:
                - name: ubuntu
                  sudo: "ALL=(ALL) NOPASSWD: ALL"
                  ssh_authorized_keys:
                    - ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC/aB/HYsb56V0NBOEab6j33v3LIxRiGqG4fmidAryAXevLyTANJPF8m44KSzSQg7AI7PMy6egxQp/JqH2b+3z1cItWuHZSU+klsKNuf5HxK7AOrND3ahbejZfyYewtKFQ3X9rv5Sk8TAR5gw5oPbkTR61jiLa58Sw7UkhLm2EDguGASb6mBal8iboiF8Wpl8QIvPmJaGIOY2YwXLepwFA3S3kVqW88eh2WFmjTMre5ASLguYNkHXjyb/TuhVFzAvphzpl84RAaEyjKYnk45fh4xRXx+oKqlfKRJJ/Owxa7SmGO+/4rWb3chdnpodHeu7XjERmjYLY+r46sf6n6ySgEht1xAWjMb1uqZqkDx+fDDsjFSeaN3ncX6HSoDOrphFmXYSwaMpZ8v67A791fuUPrMLC+YMckhTuX2g4i3XUdumIWvhaMvKhy/JRRMsfUH0h+KAkBLI6tn5ozoXiQhgM4SAE5HsMr6CydSIzab0yY3sq0avmZgeoc78+8PKPkZG1zRMEspV/hKKBC8hq7nm0bu4IgzuEIYHowOD8svqA0ufhDWxTt6A4Jo0xDzhFyKme7KfmW7SIhpejf3T1Wlf+QINs1hURr8LSOZEyY2SzYmAoQ49N0SSPb5xyG44cptpKcj0WCAJjBJoZqz0F5x9TjJ8XToB5obyJfRHD1JjxoMQ== dev@gitpod.io
              chpasswd:
                list: |
                  ubuntu:ubuntu
                expire: False
              runcmd:
                - curl -sfL https://get.k3s.io | sh -
                - sleep 10
                - kubectl label nodes ${vmName} gitpod.io/workload_meta=true gitpod.io/workload_ide=true gitpod.io/workload_workspace_services=true gitpod.io/workload_workspace_regular=true gitpod.io/workload_workspace_headless=true gitpod.io/workspace_0=true gitpod.io/workspace_1=true gitpod.io/workspace_2=true
                - kubectl create ns certs
                - kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.6.1/cert-manager.yaml
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
    - name: ssh
      protocol: TCP
      port: 22
      targetPort: 22
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
  selector:
    harvesterhci.io/vmName: ${vmName}
  type: ClusterIP
`
}

type UserDataSecretManifestOptions = {
  namespace: string,
  secretName: string
}
