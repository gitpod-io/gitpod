package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/containerd/containerd/contrib/seccomp"
	"github.com/opencontainers/runtime-spec/specs-go"
	"golang.org/x/sys/unix"
)

func main() {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)

	spec := specs.Spec{
		Process: &specs.Process{
			Capabilities: &specs.LinuxCapabilities{
				Bounding: os.Args[1:],
			},
		},
	}

	s := seccomp.DefaultProfile(&spec)
	s.Syscalls = append(s.Syscalls, specs.LinuxSyscall{
		Names: []string{
			"clone",
		},
		Action: specs.ActAllow,
		Args: []specs.LinuxSeccompArg{
			{
				Index:    0,
				Value:    unix.CLONE_NEWNS | unix.CLONE_NEWUSER,
				ValueTwo: 0,
				Op:       specs.OpMaskedEqual,
			},
		},
	})
	s.Syscalls = append(s.Syscalls, specs.LinuxSyscall{
		Names: []string{
			"clone",
		},
		Action: specs.ActAllow,
		Args: []specs.LinuxSeccompArg{
			{
				Index:    0,
				Value:    unix.CLONE_NEWNS,
				ValueTwo: 0,
				Op:       specs.OpMaskedEqual,
			},
		},
	})

	err := enc.Encode(s)
	if err != nil {
		log.Fatalf("cannot marshal seccomp profile: %q", err)
	}
}
