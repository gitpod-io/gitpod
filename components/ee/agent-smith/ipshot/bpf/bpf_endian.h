#ifndef __BPF_ENDIAN__
#define __BPF_ENDIAN__

#define ___bpf_mvb(x, b, n, m) ((__u##b)(x) << (b - (n + 1) * 8) >> (b - 8) << (m * 8))

#define ___bpf_swab16(x) ((__u16)(___bpf_mvb(x, 16, 0, 1) | \
                                  ___bpf_mvb(x, 16, 1, 0)))

#if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
#define __bpf_htons(x) __builtin_bswap16(x)
#define __bpf_constant_htons(x) ___bpf_swab16(x)
#elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
#define __bpf_htons(x) (x)
#else
#error "Fix your compiler's __BYTE_ORDER__?!"
#endif

#define bpf_htons(x) \
    (__builtin_constant_p(x) ? __bpf_constant_htons(x) : __bpf_htons(x))

#endif