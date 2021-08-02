package main

import (
	"encoding/binary"
	"unsafe"
)

var endian binary.ByteOrder

func init() {
	var i int = 0x1
	if (*[int(unsafe.Sizeof(i))]byte)(unsafe.Pointer(&i))[0] == 0 {
		endian = binary.BigEndian
		return
	}
	endian = binary.LittleEndian
}
