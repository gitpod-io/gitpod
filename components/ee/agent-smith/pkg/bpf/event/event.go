package event

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"unsafe"

	"github.com/cilium/ebpf/perf"
	"github.com/davecgh/go-spew/spew"
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

type param struct {
	Valptr []byte
	Len    uint16
}

func byteSliceToIntSlice(b []byte) []int16 {
	intSlice := make([]int16, len(b))
	for i, b := range b {
		intSlice[i] = int16(b)
	}
	return intSlice
}

func loadParameters(evtHdr EventHeader, buffer []byte) []param {
	var retOff uint16

	headerOffset := uint16(unsafe.Sizeof(evtHdr))
	lensBuff := buffer[headerOffset : headerOffset+uint16(evtHdr.NParams)]
	lens := byteSliceToIntSlice(lensBuff)
	spew.Dump("ORIGINAL BUFFER", buffer[headerOffset:])
	spew.Dump("LENS", lens)
	spew.Dump("LENSB", lensBuff)

	off := headerOffset + uint16(evtHdr.NParams) + uint16(unsafe.Sizeof(retOff))
	bufPtr := buffer[off:]

	params := []param{}
	for i := 0; i < int(evtHdr.NParams); i++ {
		param := param{}
		param.Valptr = bufPtr
		spew.Dump("BUF", i, bufPtr)
		param.Len = uint16(lens[i])
		params = append(params, param)
		off += uint16(lens[i])
		spew.Dump("OFF", i, off)
		bufPtr = bufPtr[off:]
	}

	return params
}
