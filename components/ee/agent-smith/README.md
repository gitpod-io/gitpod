# Agent Smith 🕵️‍♂️

TODO: write intro section

TODO: write architectural section

## eBPF development inside the Gitpod workspace

TODO: change this to leeway run components/agent-smith:prepare-environment
Prepare the environment (it should've been already prepared when you started your Gitpod wrokspace)

```bash
cd components/agent-smith
./scripts/prepare-bpf-dev-environment.sh
```

Start the VM, if it was not started with your Gitpod workspace.

(username: root, password: root)

```bash
cd components/agent-smith
./scripts/qemu.sh
```

Build agent-smith and copy it in the VM

TODO: change the chart path when we do an agent-smith chart.

```
go build .
scp -P 2222 agent-smith root@127.0.0.1:/root/agent-smith
scp -P 2222 /workspace/gitpod/charts/gitpod_io/config/agent-smith/config.json  root@127.0.0.1:/root/config.json
```


Start agent-smith in the VM

```
ssh -p 2222 root@127.0.0.1 /tmp/agent-smith run --config /root/config.json
```

You can now SSH into the VM and test infringements to see how agent-smith reacts


Build the BPF probe (only needed if the downloaded one is not enough, i.e: doing some development or debugging)

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




# Scratchpad

```
leeway build components/agent-smith:falco-bpf-probe --serve 0.0.0.0:8081
ssh -p 2222 root@127.0.0.1  curl -L -o /root/probe.o http://10.0.2.2:8081/probe.o
```
