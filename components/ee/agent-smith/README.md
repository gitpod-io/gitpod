# Agent Smith 🕵️‍♂️

Agent smith is the component that takes care of policing workspaces
against threats and noisy neighbours to make sure that everyone gets a safe and
smooth Gitpod experience.

Agent smith makes use of eBPF to audit kernel events. In particular, it uses
the [Falco BPF driver](https://github.com/falcosecurity/libs/tree/master/driver/bpf)
as its BPF program to extract syscall information at runtime.


## State of the project

- [x] Loading of the Falco BPF probe using `cilium/ebpf`
- [x] Support for execve
- [ ] Parsing arguments for the syscalls we support
- [ ] Support for clone, vfork, fork, connect
- [ ] Glue together the data extracted from the syscalls perf loop with the Infringements
- [ ] Hook to Kubernetes and Gitpod WSS for blocking users/workspaces/pods

## eBPF development inside the Gitpod workspace


### Environment preparation
Prepare the environment (it should've been already prepared when you started your Gitpod wrokspace)

```bash
leeway run components/ee/agent-smith:prepare-environment
```

Start the VM, if it was not started with your Gitpod workspace.

(username: root, password: root)

```bash
leeway run components/ee/agent-smith:qemu
```

### Build and execute

Build agent-smith and copy it in the VM

TODO: write this section

## Falco libs BPF probe development

In case you need to do development of new features or fix bugs against the
probe and downloading it is not a viable option, you can always build it manually
as follows.

```
sudo apt install clang-7 llvm-7 -y
cd /workspace
git clone https://github.com/falcosecurity/libs.git
cd libs
mkdir build
cd build
cmake -DBUILD_BPF=On ..
cd ..
cd driver/bpf
make CLANG=clang-7 LLC=llc-7 -j16
scp -P 2222 probe.o root@127.0.0.1:/root/probe.o
```
