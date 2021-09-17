#include "linux/types.h"
#include <linux/bpf.h>
#include "bpf_helpers.h"
#include "bpf_endian.h"
#include <stddef.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/in.h>
#include <linux/tcp.h>
#include <linux/pkt_cls.h>

#ifdef NDEBUG
#define bpf_printk(fmt, ...) \
    {                        \
    }                        \
    while (0)
#endif

#ifndef IP_MF
#define IP_MF 0x2000
#endif

#ifndef IP_OFFSET
#define IP_OFFSET 0x1FFF
#endif

char LICENSE[] SEC("license") = "GPL";

static inline int ip_is_fragment(struct __sk_buff *skb, __u64 nhoff)
{
    return load_half(skb, nhoff + offsetof(struct iphdr, frag_off)) & (IP_MF | IP_OFFSET);
}

struct bpf_elf_map SEC("maps") hot = {
    .type		= BPF_MAP_TYPE_HASH,
	.size_key	= sizeof(__u32),
	.size_value	= sizeof(__u16),        // value represents the index of the domain + 1
	.pinning	= PIN_GLOBAL_NS,
	.max_elem	= 64534,                // temporary
};

// todo: IPv6
SEC("classifier")
int dropitlikeitshot(struct __sk_buff *skb)
{
    void *data_end = (void *)(unsigned long long)skb->data_end;
    void *data = (void *)(unsigned long long)skb->data;
    const int l3_offset = sizeof(struct ethhdr);
    const int l4_offset = l3_offset + sizeof(struct iphdr);

    if (data + l3_offset > data_end)
    {
        bpf_printk("classifier: [eth] size lenght check hit: continue\n");
        return TC_ACT_OK;
    }

    struct ethhdr *eth = data;
    if (eth->h_proto != bpf_htons(ETH_P_IP))
    {
        bpf_printk("classifier: [eth] protocol is %d: continue\n", eth->h_proto);
        return TC_ACT_OK;
    }

    struct iphdr *ip_header = data + l3_offset;
    if (data + l4_offset > data_end)
    {
        bpf_printk("classifier: [iph] size lenght check hit: continue\n");
        return TC_ACT_OK;
    }

    if (ip_is_fragment(skb, l3_offset))
    {
        bpf_printk("classifier: [iph] is fragment: continue\n");
        return TC_ACT_OK;
    }

    __u16 *res;
    res = bpf_map_lookup_elem(&hot, &ip_header->daddr);
    if (res != NULL) {
        bpf_printk("classifier: hit domain with index %d: block\n", bpf_htons(*res)); // -1
        return TC_ACT_SHOT;
    }

    return TC_ACT_OK;
}
