# ipshot

> Shots IP addresses

The name is ispired by [`TC_ACT_SHOT`](https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/pkt_cls.h#L62), the 32 bit action return code that terminates the packet processing pipeline and drops the packet.

## Steps

1. Build the [SCHED_CLS program](./bpf)
2. Enter the correct net ns
3. [Load the above-mentioned eBPF program with TC](./tc) - needs CAP_NET and CAP_BPF
4. Run (and let it run) the [DoH client](./doh) for the magic to happen
