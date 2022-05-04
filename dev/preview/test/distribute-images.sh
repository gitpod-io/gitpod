#!/usr/bin/env bash

set -euo pipefail

[[ "$(kubectx -c)" == "harvester" ]] || ( echo "Set kubectx to 'harvester'."; exit 1)

while getopts i:s: flag
do
    case "${flag}" in
        i) IMAGEID="${OPTARG}";;
        s) STORAGECLASS="${OPTARG}";;
        *) ;;
    esac
done

# We don't delete the namespace "distribute-${IMAGEID} because we want to avoid
# images from being garbage collected
NODES=$(kubectl get nodes -o=jsonpath='{.items[*].metadata.name}')
NAMESPACE="distribute-${IMAGEID}"

kubectl get ns "${NAMESPACE}" && kubectl delete ns "${NAMESPACE}"
kubectl create ns "${NAMESPACE}"

for NODE in $NODES
do
    VMNAME="${IMAGEID}-on-${NODE}"
    PVC="pvc-${STORAGECLASS}-${NODE}"
    kubectl apply -f - << YAML
apiVersion: kubevirt.io/v1
kind: VirtualMachine
metadata:
  namespace: ${NAMESPACE}
  annotations:
    harvesterhci.io/volumeClaimTemplates: '[{"metadata":{"name":"${PVC}","annotations":{"harvesterhci.io/imageId":"default/${IMAGEID}"}},"spec":{"accessModes":["ReadWriteMany"],"resources":{"requests":{"storage":"200Gi"}},"volumeMode":"Block","storageClassName":"${STORAGECLASS}"}}]'
    network.harvesterhci.io/ips: "[]"
  labels:
    harvesterhci.io/creator: harvester
    harvesterhci.io/os: ubuntu
  name: ${VMNAME}
spec:
  running: true
  template:
    metadata:
      annotations:
        harvesterhci.io/sshNames: "[]"
      labels:
        harvesterhci.io/vmName: ${VMNAME}
    spec:
      nodeSelector:
        kubernetes.io/hostname: ${NODE}
      domain:
        machine:
          type: q35
        cpu:
          cores: 2
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
        resources:
          limits:
            memory: 4Gi
            cpu: 2
      evictionStrategy: LiveMigrate
      networks:
        - pod: {}
          name: default
      volumes:
        - name: system
          persistentVolumeClaim:
            claimName: ${PVC}
YAML
done
