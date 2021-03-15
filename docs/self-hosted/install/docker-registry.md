---
url: /docs/self-hosted/latest/install/docker-registry/
---

# Docker Registry

Gitpod builds Docker images during workspace startup. This enables custom Dockerfiles as part of your workspace config, but is also required for Gitpod itself to function.
To this end, Gitpod requires a container registry where it can push the images it builds.

By default Gitpod ships with a built-in Docker registry. If you operate your own Docker registry (which we'd recommend in a production setting) you can use that one. You have the following options:

* Integrated docker registry: If not disabled, this docker registry is installed in a Kubernetes Pod as a dependency of Gitpod’s Helm chart.
  The docker registry requires a Kubernetes PersistentVolume. This registry is not recommended to be used for production.
* Own docker registry: Gitpod can connect to your own docker registry. Compared to its built-in counterpart this enables performance gains and access to otherwise private images.

This helm chart can either deploy its own registry (default but requires [HTTPS certs](../configures-ingress/)) or use an existing one.

## Configuration
To connect to an existing Docker registry, perform the following steps:

 1. Merge the following into your `values.custom.yaml`:
    ```
    components:
      imageBuilder:
        registryCerts: []
        registry:
          # name must not end with a "/"
          name: your.registry.com/gitpod
          secretName: image-builder-registry-secret
          path: secrets/registry-auth.json

      workspace:
        pullSecret:
          secretName: image-builder-registry-secret

    docker-registry:
      enabled: false
    ```
    Replace `your.registry.com/gitpod` with the domain your registry is available at.

    > Note that Helm does _not_ merge hierarchies in a single file. Please make sure there is only ever _one_ `components` hierarchy or the last one overwrites all previous values.

 2. Login to the registry and safe the authentication
    ```
    mkdir -p secrets
    docker login your.registry.com/gitpod && cp ~/.docker/config.json secrets/registry-auth.json
    ```

    > This does not work for Google Cloud Registries because their login tokens are short-lived. See the [example](#example-google-cloud-registry-credentials) below on how to configure it.

 3. Do a `helm upgrade --install -f values.custom.yaml gitpod gitpod.io/gitpod --version=0.8.0` to apply the changes.

Make sure the resulting JSON file contains the credentials (there should be an `auths` section containing them as base64 encoded string).

If that's not the case you might have a credential store/helper set up (e.g. on macOS the _Securely store Docker logins in macOS keychain_ setting).

### Example Google Cloud Registry Credentials

 Prerequisites:
 - `gcloud` [installed](https://cloud.google.com/sdk/docs/quickstart) and [authenticated](https://cloud.google.com/sdk/gcloud/reference/auth/login)

How to use Google Cloud Registry as Docker registry for Gitpod:
 1. Go to [https://console.cloud.google.com/gcr/images/\<your-project-id\>?project=\<your-project-id\>](https://console.cloud.google.com/gcr/images/\<your-project-id\>?project=\<your-project-id\>) and hit "Enable Registry API" (if not already enabled).

 1. Execute the following commands:
    ```
    export PROJECT_ID="<your-project-id>"

    gcloud iam service-accounts create gitpod-registry-full --project=$PROJECT_ID
    gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:gitpod-registry-full@$PROJECT_ID.iam.gserviceaccount.com" --role=roles/storage.admin
    gcloud iam service-accounts keys create gitpod-registry-full-key.json --iam-account=gitpod-registry-full@$PROJECT_ID.iam.gserviceaccount.com

    echo "{\"auths\":{\"gcr.io\": {\"auth\": \"$(echo -n "$(echo -n "_json_key:"; cat gitpod-registry-full-key.json)" | base64 -w 0)\"}}}" > secrets/registry-auth.json
    ```

    This should result in a `secrets/registry-auth.json` like this:
    ```json
    {
        "auths": {
            "gcr.io": {
                "auth": "<long-base64-string>"
            }
        }
    }
    ```

    > If you want to use the localized versions of gcr.io (eu.gcr.io, for instance) make sure to update the json file accordingly.