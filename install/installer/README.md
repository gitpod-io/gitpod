## GCP

```
docker run --rm -it \
    -v $HOME/gitpod-gcp-installation:/workspace \
    -e PROJECT_ID=foobar \
    -e REGION=europe-west1 \
    eu.gcr.io/gitpod-core-dev/install/installer:dev scripts/gcp.sh
```
