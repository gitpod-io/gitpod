# ToDo
- [x] Integrate version manifest (@MrSimonEmms, @csweichel)
- Wrap up component templates (@MrSimonEmms)
    - workspace
        - [ ] ws-daemon
        - [ ] ws-manager
        - [ ] ws-proxy
        - [ ] ws-scheduler
        - [ ] registry-facade
        - [ ] blobserve
        - [ ] agent-smith
        - [ ] docker-registry
    - meta
        - [ ] server
        - [ ] ws-manager-bridge
        - [ ] proxy
        - [ ] dashboard
        - [ ] image-builder-mk3
        - [ ] content-service

- Integrate existing helm charts (@aledbf)
    - [ ] mysql: db
    - [ ] rabbitmq: messagebus
    - [ ] jaeger
    - [ ] minio

- Database
    - [ ] Integrate DB initialization as Kubernetes job with log forwarding support
    - [ ] Integrate DB migrations as a Kubernetes job with log forwarding support

- Check cluster pre-requisites
    - [ ] Kubernetes version
    - [ ] container runtime and version
    - [ ] Kernel version
    - [ ] database version and defaults for CloudSQL and RDS
    - [ ] CNI provider (Calico with eBPF does not support host ports)

# Milestones
- [ ] Install either the GCP or EKS guide using the installer
- [ ] Produce a core-dev installation using the installer
- [ ] Produce a staging installation using the installer

## Dragons ahead

### Env vars removed from default env
- ws-daemon needs KUBE_STAGE
- integration tests need HOST_URL
- agent-smith needs GITPOD_REGION

### Deleting no longer needed objects
We maintain a list of all object kinds any version of the installer ever created.
All objects we ever create get a label so that we can identify them as created by the installer.
To delete unused objects we iterate over all objects using the obj kind list above and delete all objects the current installer version no longer produces.

### Storing the currently installed version of Gitpod
We could create a configMap and store the current Gitpod version in there.