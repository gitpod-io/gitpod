package event

import (
	"bytes"
	"encoding/binary"
	"fmt"

	"github.com/cilium/ebpf/perf"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/bpf"
)

type Event struct {
	Header EventHeader
	Buffer []byte
}

// Event is the Go representation of ppm_event_hdr
type EventHeader struct {
	Ts      uint64 /* timestamp, in nanoseconds from epoch */
	Tid     uint64 /* the tid of the thread that generated this event */
	Len     uint32 /* the event len, including the header */
	Type    uint16 /* the event type */
	NParams uint32 /* the number of parameters of the event */
}

func NewFromPerfRecord(rec perf.Record) (*Event, error) {
	var evtHdr EventHeader
	if err := binary.Read(bytes.NewBuffer(rec.RawSample), binary.LittleEndian, &evtHdr); err != nil {
		return nil, fmt.Errorf("cannot parse perf record: %v", err)
	}
	return &Event{
		Header: evtHdr,
		Buffer: rec.RawSample,
	}, nil
}

func (e *Event) Unmarshal() (interface{}, error) {
	switch e.Header.Type {
	case uint16(bpf.PPME_SYSCALL_EXECVE_19_X):
		return parseExecveExit(e.Header, e.Buffer), nil
	}

	return nil, fmt.Errorf("event type not supported: %d", e.Header.Type)
}
