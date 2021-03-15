---
url: /docs/self-hosted/latest/install/upgrade/
---

# Gitpod Self-Hosted Upgrade Notes

## Upgrading Gitpod from v0.6.0 to v0.8.0

With version 0.8.0 there are two major changes that require a user action. Both relate to the remote storage.

### Built-in MinIO is now accessable at minio.your-gitpod-domain.com

When you install Gitpod on your own Kubernetes installation, it brings a built-in MinIO object storage (unless disabled). As of v0.8.0, the built-in MinIO instance is accessable at https://minio.your-gitpod-domain.com. That's the reason that (for security reasons) we do not set a default access and secret key for the built-in MinIO installation anymore. That means, you need to add your own random keys in your values files like this:
```
minio:
  accessKey: add-a-radom-access-key-here
  secretKey: add-a-radom-secret-key-here
```

If you don't do this, `helm` will fail with the following message:

> minio access key is required, please add a value to your values.yaml


### Remote storage config has been moved to a new component

If you have a custom remote storage config (e.g. you use your own MinIO instance or the Google Cloud Storage), you need to move the config from the component `wsDaemon` to the new component `contentService`. See the [Storage Guide](../storage/) for an example.
