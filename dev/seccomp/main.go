package main

// requires libseccomp 2.5.1
// go build -ldflags '-w -extldflags "-static"'

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"seccomp/readarg"

	libseccomp "github.com/seccomp/libseccomp-golang"
	log "github.com/sirupsen/logrus"
	"golang.org/x/sys/unix"
)

func main() {
	log.Info("hello world")

	filter, err := libseccomp.NewFilter(libseccomp.ActAllow)
	if err != nil {
		log.WithError(err).Fatal("cannot create filter")
	}
	runtime.LockOSThread()
	filter.SetTsync(false)

	apiLevel, err := libseccomp.GetAPI()
	if err != nil {
		log.WithError(err).Fatal("GetAPI")
	}
	fmt.Printf("API level: %d\n", apiLevel)

	syscallID, err := libseccomp.GetSyscallFromName("mkdir")
	if err != nil {
		log.WithError(err).Fatal("GetSyscallFromName")
	}
	filter.AddRule(syscallID, libseccomp.ActNotify)
	err = filter.Load()
	if err != nil {
		log.WithError(err).Fatal("Load")
	}

	fd, err := filter.GetNotifFd()
	if err != nil {
		log.WithError(err).Fatal("GetNotifFd")
	}
	go func() {
		defer log.Warn("Notify loop shutdown")
		log.Info("notif loop running")
		for {
			req, err := libseccomp.NotifReceive(fd)
			if err != nil {
				if err == unix.ENOENT {
					log.Info("Handling of new notification could not start")
					continue
				}
				log.WithError(err).Error("Error on receiving seccomp notification")
				return
			}

			syscallName, _ := req.Data.Syscall.GetName()
			log.Infof("syscall [pid: %d]: %s\n", req.Pid, syscallName)

			// if err := libseccomp.NotifIDValid(fd, req.ID); err != nil {
			// 	log.WithError(err).WithField("id", req.ID).Warn("invalid notif ID")
			// 	fmt.Fprintf(os.Stderr, "invalid notif ID: %q\n", err)
			// 	continue
			// }
			// log.WithField("ID", req.ID).Info("notif req valid")

			errno, flags := handleMkdir(fd, req)

			err = libseccomp.NotifRespond(fd, &libseccomp.ScmpNotifResp{
				ID:    req.ID,
				Error: errno,
				Val:   0,
				Flags: flags,
			})

			if err != nil {
				log.WithError(err).Warn("cannot respond")
			}
		}
	}()
	time.Sleep(100 * time.Microsecond)

	cmd := exec.Command("/bin/bash")
	cmd.Stdout = os.Stdout
	cmd.Stdin = os.Stdin
	cmd.Stderr = os.Stderr
	cmd.Run()

	// err = syscall.Mkdir("/tmp/moo", 0755)
	// if err != nil {
	// 	log.WithError(err).Error("mkdir")
	// } else {
	// 	fmt.Printf("I just created a file\n")
	// }
}

func handleMkdir(fd libseccomp.ScmpFd, req *libseccomp.ScmpNotifReq) (errno int32, flags uint32) {
	memFile, err := readarg.OpenMem(req.Pid)
	if err != nil {
		flags = libseccomp.NotifRespFlagContinue
		return
	}
	defer memFile.Close()

	// if err := libseccomp.NotifIDValid(fd, req.ID); err != nil {
	// 	log.WithField("fd", fd).WithField("ID", req.ID).Warn("NotifIDValid")
	// 	errno = -1
	// 	return
	// }

	filename, err := readarg.ReadString(memFile, int64(req.Data.Args[0]))
	if err != nil {
		log.WithFields(log.Fields{
			"fd":  fd,
			"pid": req.Pid,
			"err": err,
		}).Error("Cannot read argument")
		errno = -int32(unix.EFAULT)
		return
	}

	filename = strings.TrimSpace(filename)
	if strings.Contains(filename, "/demo") {
		log.WithField("arg", filename).Info("mkdir")

		os.MkdirAll(filename+"-seccomp-was-here", 0644)
	}
	return
}
