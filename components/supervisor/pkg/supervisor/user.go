// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"fmt"
	"os/exec"
	"os/user"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
)

type AddUserOpts struct {
	Name         string
	UID          int
	Group        int
	Home         string
	DefaultShell string
}

func AddGitpodUserIfNotExists() error {
	ok, err := hasGitpodGroup()
	if err != nil {
		return err
	}
	if !ok {
		err = addGroup("gitpod", gitpodGID)
		if err != nil {
			return err
		}
	}

	ok, err = hasGitpodUser()
	if err != nil {
		return err
	}
	if ok {
		return nil
	}

	return addUser(AddUserOpts{
		Name:         "gitpod",
		UID:          gitpodUID,
		Group:        gitpodGID,
		Home:         "/home/gitpod",
		DefaultShell: "/bin/sh",
	})
}

func hasGitpodGroup() (bool, error) {
	gid := strconv.Itoa(gitpodGID)
	_, err := user.LookupGroupId(gid)
	if err == user.UnknownGroupIdError(gid) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func hasGitpodUser() (bool, error) {
	usr, err := user.Lookup("gitpod")
	if err == user.UnknownUserError("gitpod") {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if usr.Uid != strconv.Itoa(gitpodUID) {
		return true, fmt.Errorf("gitpod user UID is not %d", gitpodUID)
	}
	if usr.Gid != strconv.Itoa(gitpodGID) {
		return true, fmt.Errorf("gitpod user GID is not %d", gitpodGID)
	}
	return true, nil
}

func addGroup(name string, gid int) error {
	flavour := determineAdduserFlavour()
	if flavour == adduserUnknown {
		return fmt.Errorf("no addgroup command found")
	}

	args := addgroupCommand[flavour](name, gid)
	out, err := exec.Command(args[0], args[1:]...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%w: %s", err, string(out))
	}
	log.WithField("args", args).Debug("addgroup")

	return nil
}

func addUser(opts AddUserOpts) error {
	flavour := determineAdduserFlavour()
	if flavour == adduserUnknown {
		return fmt.Errorf("no adduser command found")
	}

	args := adduserCommand[flavour](opts)
	out, err := exec.Command(args[0], args[1:]...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v: %w: %s", args, err, string(out))
	}
	log.WithField("args", args).Debug("adduser")

	return nil
}

func determineAdduserFlavour() adduserFlavour {
	for flavour, gen := range adduserCommand {
		args := gen(AddUserOpts{})
		var flags []string
		for _, a := range args {
			if len(a) > 0 && a[0] == '-' {
				flags = append(flags, a)
			}
		}

		rout, _ := exec.Command(args[0], "-h").CombinedOutput()
		var (
			out   = string(rout)
			found = true
		)
		for _, f := range flags {
			if !strings.Contains(out, f) {
				found = false
				break
			}
		}
		if found {
			return flavour
		}
	}

	return adduserUnknown
}

type adduserFlavour int

const (
	adduserUnknown adduserFlavour = iota
	adduserBusybox
	adduserDebian
	adduserUseradd
)

var adduserCommand = map[adduserFlavour]func(AddUserOpts) []string{
	adduserBusybox: func(opts AddUserOpts) []string {
		return []string{"adduser", "-h", opts.Home, "-s", opts.DefaultShell, "-D", "-G", strconv.Itoa(opts.Group), "-u", strconv.Itoa(opts.UID), opts.Name}
	},
	adduserDebian: func(opts AddUserOpts) []string {
		return []string{"adduser", "--home", opts.Home, "--shell", opts.DefaultShell, "--disabled-login", "--gid", strconv.Itoa(opts.Group), "--uid", strconv.Itoa(opts.UID), opts.Name}
	},
	adduserUseradd: func(opts AddUserOpts) []string {
		return []string{"useradd", "-m", "--home-dir", opts.Home, "--shell", opts.DefaultShell, "--gid", strconv.Itoa(opts.Group), "--uid", strconv.Itoa(opts.UID), opts.Name}
	},
}

var addgroupCommand = map[adduserFlavour]func(name string, gid int) []string{
	adduserBusybox: func(name string, gid int) []string {
		return []string{"addgroup", "-g", strconv.Itoa(gid), name}
	},
	adduserDebian: func(name string, gid int) []string {
		return []string{"addgroup", "--gid", strconv.Itoa(gid), name}
	},
	adduserUseradd: func(name string, gid int) []string {
		return []string{"groupadd", "--gid", strconv.Itoa(gid), name}
	},
}
