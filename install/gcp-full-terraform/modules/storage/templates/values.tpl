components:
  wsSync:
    volumes:
    - name: gcloud-creds
      secret:
        secretName: ${secret_name}
    - name: gcloud-tmp
      hostPath:
        path: /mnt/disks/ssd0/sync-tmp
        type: DirectoryOrCreate
    volumeMounts:
    - mountPath: /credentials
      name: gcloud-creds
    - mountPath: /mnt/sync-tmp
      name: gcloud-tmp
    remoteStorage:
      kind: gcloud
      gcloud:
        # You need to set your GCP project ID here.
        # Beware: the name of your project is not the same as its ID. You can find the project ID under the "Home" page of your GCP project.
        projectId: ${project}
        # The GCP region you want the workspace content to be stored in. This should ideally be in the same region as your cluster.
        region: ${region}
        # You shouldn't have to change the values below if you're using the templates that ship with this chart.
        credentialsFile: /credentials/key.json
        tmpdir: /mnt/sync-tmp
        parallelUpload: 6
  server:
    storage:
      secretName: ${secret_name}
      keyFilePath: key.json
minio:
  enabled: false