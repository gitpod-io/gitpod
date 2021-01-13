package main

import (
	"fmt"
	"os"
	"syscall"

	libseccomp "github.com/seccomp/libseccomp-golang"
)

func main() {
	filter, err := libseccomp.NewFilter(libseccomp.ActAllow)
	if err != nil {
		fmt.Printf("Error creating filter: %s\n", err)
	}

	syscallID, err := libseccomp.GetSyscallFromName("mkdir")
	if err != nil {
		panic(err)
	}
	filter.AddRule(syscallID, libseccomp.ActNotify)
	err = filter.Load()
	if err != nil {
		panic(err)
	}

	fd, err := filter.GetNotifFd()
	if err != nil {
		panic(err)
	}
	go func() {
		for {
			req, err := libseccomp.NotifReceive(fd)
			if err != nil {
				panic(err)
			}
			if err := libseccomp.NotifIDValid(fd, req.ID); err != nil {
				fmt.Fprintf(os.Stderr, "invalid notif ID: %q\n", err)
				continue
			}

			syscallName, _ := req.Data.Syscall.GetName()
			fmt.Fprintf(os.Stdout, "syscall [pid: %d]: %s\n", req.Pid, syscallName)
			libseccomp.NotifRespond(fd, &libseccomp.ScmpNotifResp{
				ID:    req.ID,
				Error: 0,
				Val:   0,
				Flags: libseccomp.NotifRespFlagContinue,
			})
		}
	}()

	err = syscall.Mkdir("/tmp/moo", 0755)
	if err != nil {
		panic(err)
	} else {
		fmt.Printf("I just created a file\n")
	}
}
