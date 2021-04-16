components:
  wsDaemon:
    hostWorkspaceArea: /var/gitpod/workspaces
    name: "ws-daemon"
    remoteStorage:
      kind: minio
      minio:
        accessKey: ${access_key}
        endpoint: minio:9000
        secretKey: ${secret_key}
        tmpdir: /tmp
minio:
  enabled: false