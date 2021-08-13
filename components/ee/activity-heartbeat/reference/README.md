# Reference C for the activity-heartbeat eBPF program

To make this compile, you first have to install [libbpf](https://github.com/libbpf/libbpf).

Once you have that, you can compile the program with.

```bash
clang -O2 -target bpf -g -c pid.c
```

This will give you a file called `pid.o` which you can then disassemble with `llvm-objdump`


```bash
llvm-objdump -d -S --no-show-raw-insn --symbolize-operands pid.o
```

Now, compare that with the `bpf.go` file in the parent directory, you should see that the instructions are the same.

It will look like this:


```

pid.o:	file format elf64-bpf


Disassembly of section tracepoint/syscalls/sys_enter_read:

0000000000000000 <activity_heartbeat>:
; int activity_heartbeat(struct trace_event_raw_sys_enter *ctx) {
       0:	r6 = r1
;   int read_fd = ctx->args[0];
       1:	r1 = *(u64 *)(r6 + 16)
       2:	r1 <<= 32
       3:	r1 >>= 32
;   if (read_fd != 0) {
       4:	if r1 != 0 goto +31 <LBB0_5>
;   pid = bpf_get_current_pid_tgid() >> 32;
       5:	call 14
       6:	r0 >>= 32
       7:	*(u64 *)(r10 - 8) = r0
       8:	r2 = r10
;   pid = bpf_get_current_pid_tgid() >> 32;
       9:	r2 += -8
;   considered = bpf_map_lookup_elem(&considered_pids_map, &pid);
      10:	r1 = 0 ll
      12:	call 1
;   if (considered == NULL) {
      13:	if r0 != 0 goto +11 <LBB0_3>
      14:	r1 = 0
;     bool false_val = false;
      15:	*(u8 *)(r10 - 9) = r1
      16:	r2 = r10
      17:	r2 += -8
      18:	r3 = r10
      19:	r3 += -9
;     bpf_map_update_elem(&considered_pids_map, &pid, &false_val, 0);
      20:	r1 = 0 ll
      22:	r4 = 0
      23:	call 2
      24:	goto +11 <LBB0_5>

00000000000000c8 <LBB0_3>:
;   if (*considered == false) {
      25:	r1 = *(u8 *)(r0 + 0)
      26:	if r1 == 0 goto +9 <LBB0_5>
      27:	r4 = r10
      28:	r4 += -8
;   bpf_perf_event_output(ctx, &activity_heartbeat_map, BPF_F_CURRENT_CPU, &pid,
      29:	r1 = r6
      30:	r2 = 0 ll
      32:	r3 = 4294967295 ll
      34:	r5 = 8
      35:	call 25

0000000000000120 <LBB0_5>:
; }
      36:	r0 = 0
      37:	exit
```


Please remember that we do not consider the map definitions in the translation and
also the structs are not considered.
In our case we only access to `ctx->args[0];` which is the file descriptor which in asm
can be accessed with `r1 = *(u64 *)(r6 + 16)`, the offset is `16` bytes from the beginning and might change,
in case it changes we can make a condition in Go to change that for the current kernel implementation.
