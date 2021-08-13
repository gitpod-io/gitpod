# Activity heartbeat

Status: Implemented, needs to be integrated into ws-daemon and ws-manager.

## What does it do?

For every program name specified in `consideredPrograms`, it will write a line with
the current unix timestamp and the PID of that program to stdout.


## Why ?

The reason is that we want to integrate this into ws-daemon and ws-manager
to do the keepalive for terminal programs.

Printing to stdout now is just to show that it works, the pids need to be used
in ws-daemon and ws-manager to do the keepalive for the workspace.

## How ?

This is made with an eBPF program that will look for all the read syscalls
against the current stdin file descriptor for every process in the system.

The eBPF program is written in using the [Assembler](https://pkg.go.dev/github.com/cilium/ebpf/asm) provided by the eBPF library.

But wait, the program was not written in asm from scratch, a C program was used as reference. You can find that C program
in the `reference` folder in this folder. The reference folder has all the comamands to compile the reference code and disassemble it.

Look at the `bpf.go` file for the actual program we are using.

More on how to translate programs to the Assembler from libbpf-go in [this article](https://fntlnz.wtf/post/bpf-go-asm/).

## How to compile and use

Since everything is in Go, just go build. This does not use leeway because everthing here will be moved away to ws-daemon and ws-manager anyways.

```
go build .
sudo ./activity-heartbeat
```

Now, in another terminal you can open vim to test it, here is what you should see after moving around a little bit.

Timestamp - PID

```
1628815021831806232 - 7171
1628815021833171383 - 7171
1628815021944808515 - 7171
1628815022164506090 - 7171
1628815022183451613 - 7171
1628815022289289767 - 7171
```


### Metrics

This exposes a prometheus metrics server to give a counter of how many 'editors' are currently open.

```
curl http://127.0.0.1:9090/metrics
```

Will give you something like this:

```
gitpod_acitivity_heartbeat_currently_considered_pids 1
```

### More eBPF plumbing

You can look at what are the current considered PIDs at any moment with [bpftool](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/tools/bpf/bpftool)

```
sudo bpftool map dump name considered_pids
```

Will output something like this:

```
key: cf 1c 00 00 00 00 00 00  value: 01
Found 1 element
```

Where key is the hex value of the PID and value is `01` (considered) for true and `00` for false (not considered).
Not considered PIDs are garbage collected.
