# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

components:

  contentService:
    remoteStorage:
      kind: gcloud
      # Not strictly necessary, but nice-to-have
      backupTrail:
        enabled: true
        maxLength: 3
      gcloud:
        parallelUpload: 6
        maximumBackupSize: 32212254720 # 30 GiB
        projectId: ${project}
        region: ${region}
        credentialsFile: /credentials/key.json
        tmpdir: /mnt/sync-tmp

  wsDaemon:
    hostWorkspaceArea: /var/gitpod/workspaces
    containerRuntime:
      runtime: containerd
      containerd:
        socket: /run/containerd/containerd.sock
      nodeRoots:
        - /var/lib
    # we want to be as compatible as possible, so disable those
    userNamespaces:
      shiftfsModuleLoader:
        enabled: false
      # seccompProfileInstaller:
      #   enabled: true
    volumes:
    - name: gcloud-creds
      secret:
        secretName: ${secretName}
    - name: gcloud-tmp
      hostPath:
        path: /mnt/disks/ssd0/sync-tmp
        type: DirectoryOrCreate
    volumeMounts:
    - mountPath: /credentials
      name: gcloud-creds
    - mountPath: /mnt/sync-tmp
      name: gcloud-tmp

  wsManager:
    volumes:
    - name: gcloud-creds
      secret:
        secretName: ${secretName}
    volumeMounts:
    - mountPath: /credentials
      name: gcloud-creds

minio:
  enabled: false
