# Test Installation Docker Container

In order to test Gitpod (self-hosted) installations, this folder provides a Docker container that can be used to setup test installations. It is based on ansible and provides different ansible playbooks to setup and teardown different settings.

## How to run the container

```bash
$ TAG=<your tag>
$ PLAYBOOK=<your playbook>
$ docker run --rm -it eu.gcr.io/gitpod-core-dev/build/test-installations:$TAG "$PLAYBOOK"
```

Run with no playbook to get a list of available playbook.

You can also add arbitrary `ansible-playbook` args behind the playbook arg.

When using GCP playbooks, you need to mount a service account key file like this:

```bash
$ docker run --rm -it \
    -v /path/to/service-account.json:/service-account.json:ro \
    eu.gcr.io/gitpod-core-dev/build/test-installations:$TAG "$PLAYBOOK"
```

The configuration of the playbooks are in `ansible/vars` (e.g. the Gitpod domain, GCP project, etc.). You can change the values in the vars file and mount them like this:
```bash
docker run --rm -it \
    -v /tmp/service-account.json:/service-account.json:ro \
    -v /workspace/gitpod/test-installations/ansible/vars:/ansible/vars:ro \
    eu.gcr.io/gitpod-core-dev/build/test-installations:$TAG "$PLAYBOOK"
```
