package bpf

import (
	"encoding/binary"
	"fmt"
	"os"
	"runtime"
	"time"

	"golang.org/x/sys/unix"

	"github.com/cilium/ebpf"
	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/perf"
)

var NativeEndian binary.ByteOrder

const (
	perfMap         = "perf_map"
	settingsMap     = "settings_map"
	tmpScratchMap   = "tmp_scratch_map"
	frameScratchMap = "frame_scratch_map"
	localStateMap   = "local_state_map"
	tailMap         = "tail_map"
	syscallTableMap = "syscall_table"
	eventTableMap   = "event_info_table"
	fillersTableMap = "fillers_table"

	bpfSysEnterProgram = "bpf_sys_enter"
	bpfSysExitProgram  = "bpf_sys_exit"
	sysEnterProgram    = "sys_enter"
	sysExitProgram     = "sys_exit"

	gplLicense = "GPL"

	defaultSnapLen = 80

	fillerPrefix = "filler/"
)

// Settings is the Go representation of the settings map in the falco-libs BPF probe
// the C counterpart can be found here
// https://github.com/falcosecurity/libs/blob/a75b361ca1df8713acc0636b943dd154144ea30d/driver/bpf/types.h#L190-L204
type Settings struct {
	bootTime                  uint64
	socketFileOpts            [8]uint8 // this is actually a void pointer
	snaplen                   uint32
	samplingRatio             uint32
	captureEnabled            bool
	doDynamicSnaplen          bool
	pageFaults                bool
	droppingMode              bool
	isDropping                bool
	tracersEneabled           bool
	fullcapturePortRangeStart uint16
	fullcapturePortRangeEnd   uint16
	statsdPort                uint16
}

func setupRlimit() error {
	return unix.Setrlimit(unix.RLIMIT_MEMLOCK, &unix.Rlimit{
		Cur: unix.RLIM_INFINITY,
		Max: unix.RLIM_INFINITY,
	})
}

// fix license adds the GPL license to all the programs
// in the BPF collection spec.
// This is needed until we use a falco-libs release that
// contains this commit https://github.com/falcosecurity/libs/pull/22/commits/ff6d4b411c733121680bdcb079feae546ec4fec2
func fixLicense(spec *ebpf.CollectionSpec) {
	for _, p := range spec.Programs {
		p.License = gplLicense
	}
}

func adjustPerCPUMaps(maps map[string]*ebpf.MapSpec) {
	ncpu := uint32(runtime.NumCPU())
	for name, m := range maps {
		if name == tmpScratchMap ||
			name == frameScratchMap ||
			name == perfMap ||
			name == localStateMap {
			m.MaxEntries = ncpu
		}
	}
}

func getMap(coll *ebpf.Collection, name string) (*ebpf.Map, error) {
	mapObj, ok := coll.Maps[name]
	if !ok {
		return nil, fmt.Errorf("%s not found", name)
	}
	if mapObj == nil {
		return nil, fmt.Errorf("%s is nil", name)
	}
	return mapObj, nil
}

func getFillerPrograms(spec *ebpf.Collection) map[string]*ebpf.Program {
	fillers := map[string]*ebpf.Program{}
	for name, prog := range spec.Programs {
		if _, ok := fillersHash[name]; ok {
			fillers[name] = prog
			continue
		}
	}
	return fillers
}

type AgentSmithBPFProgram struct {
	spec      *ebpf.CollectionSpec
	coll      *ebpf.Collection
	enterLink *link.Link
	exitLink  *link.Link
	reader    *perf.Reader
}

func (a *AgentSmithBPFProgram) Close() error {
	a.coll.Close()
	if err := (*a.enterLink).Close(); err != nil {
		return err
	}
	if err := (*a.exitLink).Close(); err != nil {
		return err
	}
	if err := a.reader.Close(); err != nil {
		return err
	}
	return nil
}

func (a *AgentSmithBPFProgram) Read() (perf.Record, error) {
	return a.reader.Read()
}

func populateSyscallTableMap(coll *ebpf.Collection) error {
	syscallTableMap, err := getMap(coll, syscallTableMap)
	if err != nil {
		return err
	}
	for k, v := range SyscallsTable {
		if err := syscallTableMap.Update(k, &v, ebpf.UpdateAny); err != nil {
			return fmt.Errorf("error updating the syscalls table map: %v", err)
		}
	}
	return nil
}

func populateFillersTableMap(coll *ebpf.Collection) error {
	fillersTableMap, err := getMap(coll, fillersTableMap)
	if err != nil {
		return err
	}
	for k, v := range FillersTable {
		if err := fillersTableMap.Update(k, &v, ebpf.UpdateAny); err != nil {
			return fmt.Errorf("error updating the syscalls table map: %v", err)
		}
	}
	return nil
}

func populateEventTableMap(coll *ebpf.Collection) error {
	eventTableMap, err := getMap(coll, eventTableMap)
	if err != nil {
		return err
	}
	for k, v := range EventTable {
		if err := eventTableMap.Update(k, &v, ebpf.UpdateAny); err != nil {
			return fmt.Errorf("error updating the event table map: %v", err)
		}
	}
	return nil
}

func populateFillersMap(coll *ebpf.Collection) error {
	fillers := getFillerPrograms(coll)

	tailMapObj, err := getMap(coll, tailMap)
	if err != nil {
		return err
	}

	for name, prog := range fillers {
		fillerID := fillersHash[name]
		progfd := uint32(prog.FD())
		if err := tailMapObj.Update(&fillerID, &progfd, ebpf.UpdateAny); err != nil {
			return fmt.Errorf("error updating the fillers map: %v", err)
		}
	}
	return nil
}

func LoadAndAttach(elfPath string) (*AgentSmithBPFProgram, error) {
	abpf := &AgentSmithBPFProgram{}
	spec, err := ebpf.LoadCollectionSpec(elfPath)
	if err != nil {
		return nil, err
	}

	fixLicense(spec)
	adjustPerCPUMaps(spec.Maps)
	abpf.spec = spec

	if err := setupRlimit(); err != nil {
		return nil, err
	}

	coll, err := ebpf.NewCollection(spec)
	if err != nil {
		return nil, err
	}

	abpf.coll = coll

	enterProg, ok := coll.Programs[bpfSysEnterProgram]
	if !ok {
		return nil, fmt.Errorf("syscall enter program not found")
	}
	if enterProg == nil {
		return nil, fmt.Errorf("syscall enter program is nil")
	}

	exitProg, ok := coll.Programs[bpfSysExitProgram]
	if !ok {
		return nil, fmt.Errorf("syscall exit program not found")
	}
	if exitProg == nil {
		return nil, fmt.Errorf("syscall exit program is nil")
	}

	if err := populateFillersMap(coll); err != nil {
		return nil, err
	}

	if err := populateSyscallTableMap(coll); err != nil {
		return nil, err
	}

	if err := populateEventTableMap(coll); err != nil {
		return nil, err
	}

	if err := populateFillersTableMap(coll); err != nil {
		return nil, err
	}

	perfMapObj, err := getMap(coll, perfMap)
	if err != nil {
		return nil, err
	}

	settingsMapObj, err := getMap(coll, settingsMap)
	if err != nil {
		return nil, err
	}

	s := Settings{
		bootTime:                  uint64(time.Now().UnixNano()),
		socketFileOpts:            [8]uint8{},
		snaplen:                   defaultSnapLen,
		samplingRatio:             1,
		captureEnabled:            true,
		doDynamicSnaplen:          false,
		pageFaults:                false,
		droppingMode:              false,
		isDropping:                false,
		tracersEneabled:           false,
		fullcapturePortRangeStart: 0,
		fullcapturePortRangeEnd:   0,
		statsdPort:                0,
	}

	if err := settingsMapObj.Update(uint32(0), &s, ebpf.UpdateAny); err != nil {
		return nil, err
	}

	enterRawTracepoint := link.RawTracepointOptions{
		Name:    sysEnterProgram,
		Program: enterProg,
	}

	enterHook, err := link.AttachRawTracepoint(enterRawTracepoint)
	if err != nil {
		return nil, fmt.Errorf("error registering enter hook for enter raw tracepoint: %s", err.Error())
	}
	abpf.enterLink = &enterHook

	exitRawTracepoint := link.RawTracepointOptions{
		Name:    sysExitProgram,
		Program: exitProg,
	}

	exitHook, err := link.AttachRawTracepoint(exitRawTracepoint)
	if err != nil {
		return nil, fmt.Errorf("error registering exit hook for exit raw tracepoint: %s", err.Error())
	}

	abpf.exitLink = &exitHook

	pageSize := os.Getpagesize()
	ringSize := pageSize * 2048
	headerSize := pageSize
	totalSize := ringSize*2 + headerSize

	eventsReader, err := perf.NewReader(perfMapObj, totalSize)
	if err != nil {
		return nil, fmt.Errorf("error setting up perf reader for events: %s", err.Error())
	}

	abpf.reader = eventsReader

	return abpf, nil
}
