# Installing Gitpod with SSH access to workspaces with the Gitpod Installer
**_Needed by some desktop IDEs to connect to a workspace._**

> **IMPORTANT:** When you use k3s, this will open port 22 on your Kubernetes nodes for accessing the workspaces. This will prevent login to the cluster via SSH. If you wish to maintain SSH access to your cluster, please configure another SSH port on your nodes.

To enable the SSH gateway you need to generate a host key, need to add it as secret to your Kubernetes cluster, and need to configure the Gitpod Installer to use this secret.

You can use `ssh-keygen` to generate a host key like this:

```
ssh-keygen -t rsa -q -N "" -f host.key
```

Add it to your Kubernetes cluster like this:
```
kubectl create secret generic ssh-gateway-host-key --from-file=host.key
```

Add the following to your Gitpod config `gitpod.config.yaml`:
```yaml
sshGatewayHostKey:
  kind: secret
  name: ssh-gateway-host-key
```

That's it. Install Gitpod as usual, consider adding firewall rules that allow the connection on port 22 to your workspace nodes, and you can use desktop IDEs that need SSH access to connect to your workspace.
