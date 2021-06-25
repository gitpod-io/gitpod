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

SSH in the VM

```
ssh vm
```

If you now go under the `/workspace` folder in the VM, you will find all your workspace stuff.

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
```


## Debugging the Linux kernel

In case you need to debug the kernel while working on it.

First, you need to compile the ubuntu kernel yourself, the default one
does not come with debugging symbols unfortunately.


### Step zero: obtain build dependencies

```
sudo apt update -y
sudo apt install flex bison gcc make libelf-dev liblz4-tool -y
```

### First step: Obtain kernel sources


You can either obtain Ubuntu's sources (**slower**)

```shell
git clone --depth 1  git://kernel.ubuntu.com/ubuntu/ubuntu-$(lsb_release --codename | cut -f2).git /workspace/kernel
```

Or get the released tarball (**faster**)

```shell
cd /workspace
wget https://mirrors.edge.kernel.org/ubuntu/pool/main/l/linux-gke/linux-gke_5.4.0.orig.tar.gz
tar -xvf linux-gke_5.4.0.orig.tar.gz
mv linux-5.4 kernel
```

### Second step: configure and compile

Now you can compile it, make sure to create the proper config.

Remember to:

- Enable debugging sysmbols under Kernel Hacking -> compile options  OR set : `CONFIG_DEBUG_INFO=y` in `.config`j

```shell
cd /workspace/kernel
# to create the config
make menuconfig
# everything compiled into the kernel, no modules. Tricky to get modules in the vm at this stage
sed  -i 's/=m/=y/g' .config
make -j16
```

### Third step: debug!

Now stop the already started qemu VM (if any) by using `Ctrl-a c` in its terminal pane, then start
it with the new `VMLINUX_PATH`.

```shell
VMLINUX_PATH=$PWD/vmlinux leeway run components/ee/agent-smith:qemu
```

Now that you have the qemu machine in debugging mode, you can connect via gdb.


```shell
gdb vmlinux
```

Once gdb opens:

```gdb
(gdb) target remote localhost:1234
```

Now you can put breakpoints in the kernel source and use gdb against it.

Please refer to the [QEMU docs](https://qemu.readthedocs.io/en/latest/system/gdb.html) for more useful tips.
