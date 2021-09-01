# Gitpod running in k3s Docker container with 3 nodes

This examples illustrates how to use the `gitpod-k3s` Docker images with 3 nodes (1 master node, 2 worker nodes). Add MinIO secrets in `values/minio-secrets.yaml`, your domain in a `.env` file, your HTTPS certs, and run `docker-compose up`.

## How to add additional nodes on a different server

1. Expose the k3s port `6443` of the main node (gitpod service) in the `docker-compose.yaml` file.
2. Add external IP address of your server that runs the main node as external address in the `docker-compose.yaml` file by adding these arguments to the command line of the gitpod service: `--node-external-ip 10.0.0.75 --tls-san 10.0.0.75` (replace external server IP accordingly).
3. On the second server create the following files:
   1. Copy `node-entrypoint.sh`.
   2. Create `docker-compose.yaml`:
      ```
      version: '3'
      services:
        node3:
          image: rancher/k3s:v1.20.0-k3s2
          privileged: true
          volumes:
            - gitpod-workspaces-node3:/var/gitpod/workspaces
            - ./node-entrypoint.sh:/entrypoint
          environment:
            - DOMAIN=${DOMAIN}
            - K3S_URL=https://<host-of-k3s-main-node>:6443
            - K3S_CLUSTER_SECRET=qWo6sn3VWERh3dBBQniPLTqtZzEHURsriJNhTqus
            - K3S_NODE_NAME=node3
          entrypoint: /entrypoint
      volumes:
        gitpod-workspaces-node3:
      ```
3. Run `docker-compose up` on both machines.
