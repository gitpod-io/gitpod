#ifndef __BPF_HELPERS__
#define __BPF_HELPERS__

/*
 * bpf_map_lookup_elem
 *
 * 	Perform a lookup in *map* for an entry associated to *key*.
 *
 * Returns
 * 	Map value associated to *key*, or **NULL** if no entry was
 * 	found.
 */
static void *(*bpf_map_lookup_elem)(void *map, const void *key) = (void *) 1;

/*
 * bpf_trace_printk
 *
 * 	This helper is a "printk()-like" facility for debugging. It
 * 	prints a message defined by format *fmt* (of size *fmt_size*)
 * 	to file *\/sys/kernel/debug/tracing/trace* from DebugFS, if
 * 	available. It can take up to three additional **u64**
 * 	arguments (as an eBPF helpers, the total number of arguments is
 * 	limited to five).
 *
 * 	Each time the helper is called, it appends a line to the trace.
 * 	Lines are discarded while *\/sys/kernel/debug/tracing/trace* is
 * 	open, use *\/sys/kernel/debug/tracing/trace_pipe* to avoid this.
 * 	The format of the trace is customizable, and the exact output
 * 	one will get depends on the options set in
 * 	*\/sys/kernel/debug/tracing/trace_options* (see also the
 * 	*README* file under the same directory). However, it usually
 * 	defaults to something like:
 *
 * 	::
 *
 * 		telnet-470   [001] .N.. 419421.045894: 0x00000001: <formatted msg>
 *
 * 	In the above:
 *
 * 		* ``telnet`` is the name of the current task.
 * 		* ``470`` is the PID of the current task.
 * 		* ``001`` is the CPU number on which the task is
 * 		  running.
 * 		* In ``.N..``, each character refers to a set of
 * 		  options (whether irqs are enabled, scheduling
 * 		  options, whether hard/softirqs are running, level of
 * 		  preempt_disabled respectively). **N** means that
 * 		  **TIF_NEED_RESCHED** and **PREEMPT_NEED_RESCHED**
 * 		  are set.
 * 		* ``419421.045894`` is a timestamp.
 * 		* ``0x00000001`` is a fake value used by BPF for the
 * 		  instruction pointer register.
 * 		* ``<formatted msg>`` is the message formatted with
 * 		  *fmt*.
 *
 * 	The conversion specifiers supported by *fmt* are similar, but
 * 	more limited than for printk(). They are **%d**, **%i**,
 * 	**%u**, **%x**, **%ld**, **%li**, **%lu**, **%lx**, **%lld**,
 * 	**%lli**, **%llu**, **%llx**, **%p**, **%s**. No modifier (size
 * 	of field, padding with zeroes, etc.) is available, and the
 * 	helper will return **-EINVAL** (but print nothing) if it
 * 	encounters an unknown specifier.
 *
 * 	Also, note that **bpf_trace_printk**\ () is slow, and should
 * 	only be used for debugging purposes. For this reason, a notice
 * 	block (spanning several lines) is printed to kernel logs and
 * 	states that the helper should not be used "for production use"
 * 	the first time this helper is used (or more precisely, when
 * 	**trace_printk**\ () buffers are allocated). For passing values
 * 	to user space, perf events should be preferred.
 *
 * Returns
 * 	The number of bytes written to the buffer, or a negative error
 * 	in case of failure.
 */
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

#define PIN_NONE		0
#define PIN_OBJECT_NS	1
#define PIN_GLOBAL_NS	2
#define NO_PREPOPULATE	-1

struct bpf_elf_map {
	__u32 type;
	__u32 size_key;
	__u32 size_value;
	__u32 max_elem;
	__u32 flags;
	__u32 id;
	__u32 pinning;
	__u32 inner_id;
	__u32 inner_idx;
};

#endif