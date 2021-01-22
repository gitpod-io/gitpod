//
// Copyright 2019 Kinvolk
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// source: https://github.com/kinvolk/seccompagent/blob/main/pkg/readarg/readarg.go

package readarg

import (
	"bytes"
	"errors"
	"fmt"
	"os"

	"golang.org/x/sys/unix"
)

// OpenMem opens the memory file for the target process. It is done separately,
// so that the caller can call libseccomp.NotifIDValid() in between.
func OpenMem(pid uint32) (*os.File, error) {
	if pid == 0 {
		// This can happen if the seccomp agent is in a pid namespace
		// where the target pid is not mapped.
		return nil, errors.New("unknown pid")
	}
	return os.OpenFile(fmt.Sprintf("/proc/%d/mem", pid), os.O_RDONLY, 0)
}

func ReadString(memFile *os.File, offset int64) (string, error) {
	var buffer = make([]byte, 4096) // PATH_MAX

	_, err := unix.Pread(int(memFile.Fd()), buffer, offset)
	if err != nil {
		return "", err
	}

	// pread() will always return the size of the buffer, as usually
	// /proc/pid/mem is bigger than the buffer.
	// Then, to know when the string we are looking for finishes, we look
	// for the first \0 (with :bytes.IndexByte(buffer, 0)). As the string
	// should be nul-terminated, this is a simple way to find it.
	// Also, as a safety check, we add a ending 0 in the buffer, to avoid
	// doing buffer[-1] and panic, if the buffer doesn't contain any 0.
	buffer[len(buffer)-1] = 0
	s := buffer[:bytes.IndexByte(buffer, 0)]
	return string(s), nil
}

func ReadBytes(memFile *os.File, offset int64, len int) ([]byte, error) {
	var buffer = make([]byte, len)

	// pread() will always return the size of the buffer
	_, err := unix.Pread(int(memFile.Fd()), buffer, offset)
	if err != nil {
		return nil, err
	}

	return buffer, nil
}
