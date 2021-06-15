package event

import (
	"bytes"
	"unsafe"
)

func cStrLen(n []byte) int {
	for i := 0; i < len(n); i++ {
		if n[i] == 0 {
			return i
		}
	}
	return -1
}

type Execve struct {
	Filename string
	Argv     []string
	TID      int
	Envp     []string
}

func parseExecveExit(evtHdr EventHeader, buffer []byte) Execve {
	var i int16
	dataOffsetPtr := unsafe.Sizeof(evtHdr) + unsafe.Sizeof(i)*uintptr(evtHdr.NParams) - 6 // todo(fntlnz): check why this -6 is necessary
	scratchHeaderOffset := uint32(dataOffsetPtr)

	retval := int64(buffer[scratchHeaderOffset])

	// einfo := bpf.EventTable[bpf.PPME_SYSCALL_EXECVE_19_X]

	scratchHeaderOffset += uint32(unsafe.Sizeof(retval))
	command := buffer[scratchHeaderOffset:]
	commandLen := cStrLen(command)
	command = command[0:commandLen]

	scratchHeaderOffset += uint32(commandLen) + 1
	var argv []string
	rawParams := buffer[scratchHeaderOffset:]
	byteSlice := bytes.Split(rawParams, rawParams[len(rawParams)-1:])
	for _, b := range byteSlice {
		if len(b) == 0 || bytes.HasPrefix(b, []byte("\\x")) {
			break
		}
		if len(b) > 0 {
			argv = append(argv, string(b))
		}
	}

	execve := Execve{
		Filename: string(command[:]),
		Argv:     argv,
		TID:      int(evtHdr.Tid),
	}

	return execve
}
