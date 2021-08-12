// +build linux

package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"

	"golang.org/x/sys/unix"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/perf"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const bpfFCurrentCPU = 0xffffffff

const consideredPidsUpdateInterval = 5 * time.Second

const prometheusAddr = ":9090"

var consideredPrograms = map[string]bool{
	"nvim":    true,
	"nano":    true,
	"vim":     true,
	"ed":      true,
	"vi":      true,
	"emacs":   true,
	"more":    true,
	"less":    true,
	"vimdiff": true,
	"tilde":   true,
}

var progSpec = &ebpf.ProgramSpec{
	Name:    "activity_heartbeat_prob",
	Type:    ebpf.TracePoint,
	License: "GPL",
}

// extractPIDMax gets the current maximum PID from the /proc/sys/kernel/pid_max file.
// This is used to understand how big the consideredPids map should be.
func extractPIDMax() (uint32, error) {
	pidsb, err := ioutil.ReadFile("/proc/sys/kernel/pid_max")
	if err != nil {
		return 0, err
	}
	pidsElems := strings.Split(string(pidsb), "\n")
	if len(pidsElems) > 2 || len(pidsElems) < 1 {
		return 0, fmt.Errorf("pid_max file is malformed")
	}
	ret, err := strconv.Atoi(pidsElems[0])
	return uint32(ret), err
}

// getProcName returns the name of the process with the given PID.
func getProcName(pid uint64) (string, error) {
	f, err := os.Open(fmt.Sprintf("/proc/%d/comm", pid))
	if err != nil {
		return "", err
	}
	defer f.Close()

	b, err := ioutil.ReadAll(f)
	if err != nil {
		return "", err
	}

	return strings.TrimRight(string(b), "\n"), nil
}

// handleConsideredPIDS updates the consideredPids map with the current PIDs
// that are considered to be active because they are included in the consideredPrograms
// map.
// This routine also removes the PIDs from the consideredPids map that are not interesting for us.
// We could've done the two things in two different functions but it's better to iterate the map
// only here. It's true that iteration is guaranteed by the internal locking mechanism, however avoiding
// those locks is still a good idea.
func handleConsideredPIDS(consideredPids *ebpf.Map, gauge prometheus.Gauge) {
	for {
		pids := consideredPids.Iterate()
		var key uint64
		var value bool

		for pids.Next(&key, &value) {
			procName, err := getProcName(key)
			if err != nil {
				consideredPids.Delete(key)
				if value {
					gauge.Dec()
				}
				continue
			}

			if consideredPrograms[procName] {
				if !value {
					consideredPids.Update(key, true, ebpf.UpdateExist)
					gauge.Inc()
				}
				continue
			}

			consideredPids.Delete(key)
			if value {
				gauge.Dec()
			}
		}

		if err := pids.Err(); err != nil {
			log.Printf("error iterating pids: %s", err)
		}

		<-time.After(consideredPidsUpdateInterval)
	}
}

func main() {
	pidMax, err := extractPIDMax()
	if err != nil {
		log.Fatalf("error extracting the max number of pids: %s", err)
	}
	stopper := make(chan os.Signal, 1)
	signal.Notify(stopper, os.Interrupt, syscall.SIGTERM)

	if err := unix.Setrlimit(unix.RLIMIT_MEMLOCK, &unix.Rlimit{
		Cur: unix.RLIM_INFINITY,
		Max: unix.RLIM_INFINITY,
	}); err != nil {
		log.Fatalf("setting temporary rlimit: %s", err)
	}

	events, err := ebpf.NewMap(&ebpf.MapSpec{
		Type: ebpf.PerfEventArray,
		Name: "activity_heartbeat_map",
	})
	if err != nil {
		log.Fatalf("creating perf event array: %s", err)
	}

	defer events.Close()

	consideredPids, err := ebpf.NewMap(&ebpf.MapSpec{
		Type:       ebpf.Hash,
		Name:       "considered_pids_map",
		MaxEntries: pidMax,
		KeySize:    8,
		ValueSize:  1,
	})

	if err != nil {
		log.Fatalf("creating pids hashmap: %s", err)
	}

	defer consideredPids.Close()

	rd, err := perf.NewReader(events, os.Getpagesize())
	if err != nil {
		log.Fatalf("creating event reader: %s", err)
	}
	defer rd.Close()

	go func() {
		<-stopper
		rd.Close()
	}()

	progSpec.Instructions = sysEnterReadActivityProgram(consideredPids, events)

	prog, err := ebpf.NewProgram(progSpec)
	if err != nil {
		log.Fatalf("creating ebpf program: %s", err)
	}
	defer prog.Close()

	tp, err := link.Tracepoint("syscalls", "sys_enter_read", prog)
	if err != nil {
		log.Fatalf("opening tracepoint: %s", err)
	}
	defer tp.Close()

	log.Println("Waiting for events..")

	handler := http.NewServeMux()
	handler.Handle("/metrics", promhttp.Handler())

	m := NewActiviyHeartbeatMetrics()
	m.Register(prometheus.DefaultRegisterer)

	go func() {
		err := http.ListenAndServe(prometheusAddr, handler)
		if err != nil {
			log.WithError(err).Error("Prometheus metrics server failed")
		}
	}()
	log.WithField("addr", prometheusAddr).Info("started Prometheus metrics server")

	go handleConsideredPIDS(consideredPids, m.currentlyConsideredPIDS)

	for {
		record, err := rd.Read()
		if err != nil {
			if perf.IsClosed(err) {
				log.Println("Received signal, exiting..")
				return
			}
			log.Fatalf("reading from reader: %s", err)
		}

		foundPID := endian.Uint64(record.RawSample)

		// print the found pid, this should be put in ws-daemon along with the current time
		fmt.Printf("%d - %d\n", time.Now().UnixNano(), foundPID)
	}
}
