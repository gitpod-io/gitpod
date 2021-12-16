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
          cores: 1
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
            memory: 2Gi
            cpu: 1
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

export function UserDataSecretManifest({ namespace, secretName }: UserDataSecretManifestOptions) {
  const userdata = Buffer.from(`#cloud-config
users:
  - name: ubuntu
    lock_passwd: false
    sudo: "ALL=(ALL) NOPASSWD: ALL"
    passwd: "$6$exDY1mhS4KUYCE/2$zmn9ToZwTKLhCw.b4/b.ZRTIZM30JZ4QrOQ2aOXJ8yk96xpcCof0kxKwuX1kqLG/ygbJ1f8wxED22bTL4F46P0"`).toString("base64")
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
