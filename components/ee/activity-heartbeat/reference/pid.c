#include <linux/bpf.h>
#include <linux/ptrace.h>
#include <linux/version.h>
#include <stdbool.h>

#include <bpf/bpf_helpers.h>

#define MAX_CPUS 128
#define MAX_PIDS 4194034

struct {
  __uint(type, BPF_MAP_TYPE_PERF_EVENT_ARRAY);
  __uint(key_size, sizeof(int));
  __uint(value_size, sizeof(__u32));
  __uint(max_entries, MAX_CPUS);
} activity_heartbeat_map SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_HASH);
  __uint(key_size, sizeof(__u64));
  __uint(value_size, sizeof(bool));
  __uint(max_entries, MAX_PIDS);
} considered_pids_map SEC(".maps");

struct trace_entry {
  short unsigned int type;
  unsigned char flags;
  unsigned char preempt_count;
  int pid;
};

struct trace_event_raw_sys_enter {
  struct trace_entry ent;
  long int id;
  long unsigned int args[6];
  char __data[0];
};

SEC("tracepoint/syscalls/sys_enter_read")
int activity_heartbeat(struct trace_event_raw_sys_enter *ctx) {
  bool *considered;
  int read_fd = ctx->args[0];

  if (read_fd != 0) {
    return 0;
  }

  __u64 pid;
  pid = bpf_get_current_pid_tgid() >> 32;

  considered = bpf_map_lookup_elem(&considered_pids_map, &pid);

  if (considered == NULL) {
    bool false_val = false;
    bpf_map_update_elem(&considered_pids_map, &pid, &false_val, 0);
    return 0;
  }
  
  if (*considered == false) {
    return 0;
  }

  bpf_perf_event_output(ctx, &activity_heartbeat_map, BPF_F_CURRENT_CPU, &pid,
                        sizeof(pid));

  return 0;
}

char _license[] SEC("license") = "GPL";
