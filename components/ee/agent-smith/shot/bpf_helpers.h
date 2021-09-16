#ifndef __BPF_HELPERS__
#define __BPF_HELPERS__

static long (*bpf_trace_printk)(const char *fmt, __u32 fmt_size, ...) = (void *)6;

/*
 * Helper macro to place programs, maps, license in
 * different sections in elf_bpf file. Section names
 * are interpreted by libbpf depending on the context (BPF programs, BPF maps,
 * extern variables, etc).
 * To allow use of SEC() with externs (e.g., for extern .maps declarations),
 * make sure __attribute__((unused)) doesn't trigger compilation warning.
 */
#define SEC(name) \
	_Pragma("GCC diagnostic push")					    \
	_Pragma("GCC diagnostic ignored \"-Wignored-attributes\"")	    \
	__attribute__((section(name), used))				    \
	_Pragma("GCC diagnostic pop")					    \

#define __uint(name, val) int (*name)[val]
#define __type(name, val) typeof(val) *name
#define __array(name, val) typeof(val) *name[]

/* Helper macro to print out debug messages */
#define bpf_printk(fmt, ...)				\
({							\
	char ____fmt[] = fmt;				\
	bpf_trace_printk(____fmt, sizeof(____fmt),	\
			 ##__VA_ARGS__);		\
})

/*
 * Helper macros to manipulate data structures
 */
#ifndef offsetof
#define offsetof(TYPE, MEMBER)	((unsigned long)&((TYPE *)0)->MEMBER)
#endif

/* llvm builtin functions that eBPF C program may use to
 * emit BPF_LD_ABS and BPF_LD_IND instructions
 */
unsigned long long load_byte(void *skb, unsigned long long off) asm("llvm.bpf.load.byte");
unsigned long long load_half(void *skb, unsigned long long off) asm("llvm.bpf.load.half");
unsigned long long load_word(void *skb, unsigned long long off) asm("llvm.bpf.load.word");

#endif