# Running Gitpod as a Docker container

For smaller setups or to test Gitpod Self-Hosted on your local machine you can run a complete Gitpod installation as a Docker container. The Gitpod Docker image [`gitpod-k3s`](https://console.cloud.google.com/gcr/images/gitpod-core-dev/EU/build/gitpod-k3s) is based on the [`k3s` Docker image](https://hub.docker.com/r/rancher/k3s).

## Prerequisites

To run the Gitpod Docker image you need SSL certificates for HTTPS and DNS entries that point to your Docker container. See [Configure Ingress to your Gitpod installation](https://www.gitpod.io/docs/self-hosted/latest/configuration/ingress) for details.

## Running Gitpod using `docker run`

Save your SSL certificates to `./certs` and execute the following Docker command to start Gitpod in a Docker container (replace your domain):
```
$ docker run \
    --privileged \
    --name gitpod \
    --publish 443:443 --publish 80:80 \
    --env DOMAIN=your-domain.example.com \
    --volume $(pwd)/certs:/certs \
    eu.gcr.io/gitpod-core-dev/build/gitpod-k3s
```

Wait until all pods are running (see below) and open `https://your-domain.example.com` in your browser.

## Running Gitpod using `docker-compose`

To run Gitpod you can also use our sample [`docker-compose.yaml`](./examples/gitpod/docker-compose.yaml) file.

At first, you need to set your domain as an environment variable. You can do this by creating an `.env` file next to the `docker-compose.yaml` file like this:

```
DOMAIN=your-domain.example.com
```

Then, you need to save your SSL certificates to `./certs`.

After that, simple run:
```
$ docker-compose up
```

## Customize your Gitpod installation

### Custom `values.yaml` files

You can add custom `values.yaml` files for the Gitpod `helm` installation. Simple add a `*.yaml` file to the `/values/` directory of the Docker container. All files are merged to one file where the files in the `/values/` folder override values of the built-in file in case of a conflict.

### Override default MinIO and RabbitMQ credentials

It is recommended that you override the default MinIO and RabbitMQ credentials with custom random values. For this, create a YAML file with the following content:
```
minio:
  accessKey: add-here-a-random-string
  secretKey: add-here-another-random-string
rabbitmq:
  auth:
    username: gitpod
    password: add-here-a-random-string
```

and mount it into the `/values/` folder as described above.

### Specify a base domain

Instead of setting the environment variable `DOMAIN` you could also set the variable `BASEDOMAIN`. In that case, the Gitpod Docker image sets the Gitpod Domain to `gitpod.$BASEDOMAIN`. This is used in the [gitpod-gitlab example](./examples/gitpod-gitlab/docker-compose.yaml).

### Install a specific Gitpod version

You can install a specific Gitpod version by choosing the proper image tag. You'll find all image tags here: https://console.cloud.google.com/gcr/images/gitpod-core-dev/EU/build/gitpod-k3s


## Persistent volumes

The Gitpod Docker image stores its state in the following volumes:

- `/var/gitpod/docker`
- `/var/gitpod/docker-registry`
- `/var/gitpod/minio`
- `/var/gitpod/mysql`
- `/var/gitpod/workspaces`


## Troubleshooting

In the Gitpod Docker container runs a k3s Kubernetes cluster. You can access `kubectl` by running `docker exec` like this (change the Docker container name `gitpod` accordingly):
```
$ docker exec gitpod kubectl get pods
```

Gitpod will be installed in the Kubernetes cluster by the pod `gitpod-helm-installer` in the `default` namespace. That means, shortly after starting the Gitpod Docker container, you should see this pod running:
```
$ docker exec gitpod kubectl get pods
NAME                                READY   STATUS              RESTARTS   AGE
gitpod-helm-installer               1/1     Running             0          2m11s
```

The installation takes some time but finally you should see something like this:
```
$ docker exec gitpod kubectl get pods
NAME                                READY   STATUS      RESTARTS   AGE
registry-facade-7c77849c94-mdfp8    1/1     Running     0          3m24s
ws-scheduler-678fb494db-x62tp       1/1     Running     0          3m23s
svclb-proxy-bvs7g                   2/2     Running     0          3m23s
registry-548ddd9768-556bl           1/1     Running     0          3m24s
ws-manager-node-wghz7               1/1     Running     0          3m23s
minio-6845c586dc-ttvch              1/1     Running     0          3m24s
ws-sync-jv7rn                       1/1     Running     0          3m23s
ws-manager-65df9b849d-trkkc         1/1     Running     0          3m23s
image-builder-84585fb6d4-m4l66      2/2     Running     0          3m24s
ws-proxy-554857b847-bptv2           1/1     Running     0          3m23s
dashboard-9dd56dd95-svrr9           1/1     Running     0          3m24s
proxy-7fcf5cf84f-8xgmf              1/1     Running     0          3m24s
messagebus-7c59bc5c48-p5r4l         1/1     Running     0          3m24s
mysql-65c5b9f8f9-x92b5              1/1     Running     0          3m24s
gitpod-helm-installer               0/1     Completed   0          4m12s
ws-manager-bridge-b64c9f95f-5f8tf   1/1     Running     0          3m24s
server-7f8454c5c5-pndst             1/1     Running     0          3m24s
```
The `gitpod-helm-installer` pod is completed and all other pods are running.

If a pod is crashing these commands may be helpful (change the pod name accordingly):
```bash
# describe a pod:
docker exec gitpod kubectl describe pod server-7f8454c5c5-pndst

# get the logs of a pod:
docker exec gitpod kubectl logs server-7f8454c5c5-pndst
```
