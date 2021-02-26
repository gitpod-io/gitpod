# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

components:

  contentService:
    remoteStorage:
      kind: gcloud
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
        parallelUpload: 6
    volumes:
      - name: gcloud-creds
        secret:
          secretName: ${secretName}
    volumeMounts:
      - mountPath: /credentials
        name: gcloud-creds

  wsDaemon:
    name: "ws-daemon"
    hostWorkspaceArea: /var/gitpod/workspaces
    servicePort: 8080
    workspaceSizeLimit: ""
    containerRuntime:
      runtime: containerd
      containerd:
        socket: /run/containerd/containerd.sock
      nodeRoots: 
        - /var/lib
    userNamespaces:
      shiftfsModuleLoader:
        enabled: false
        imageName: "shiftfs-module-loader"
    registryProxyPort: 8081
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

  server:
    storage:
      secretName: ${secretName}
      keyFilePath: key.json
minio:
  enabled: false
