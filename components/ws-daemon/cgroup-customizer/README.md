# cgroup customizer

cgroup customizer is a small utility that will apply Gitpod's customizations
to the workspace's cgroup.

## Current customizations

- `rwm` on `10:229` for `/dev/fuse`


## Usage

```
cgroup-customizer <pid>
```

Where `<pid>` is usually the process id of supervisor.
