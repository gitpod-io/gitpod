// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"os/exec"
	"os/user"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"
)

type lookup interface {
	LookupGroup(name string) (grp *user.Group, err error)
	LookupGroupId(id string) (grp *user.Group, err error)
	Lookup(name string) (grp *user.User, err error)
	LookupId(id string) (grp *user.User, err error)
}

type osLookup struct{}

func (osLookup) LookupGroup(name string) (grp *user.Group, err error) { return user.LookupGroup(name) }
func (osLookup) LookupGroupId(id string) (grp *user.Group, err error) { return user.LookupGroupId(id) }
func (osLookup) Lookup(name string) (grp *user.User, err error)       { return user.Lookup(name) }
func (osLookup) LookupId(id string) (grp *user.User, err error)       { return user.LookupId(id) }

var defaultLookup lookup = osLookup{}

func AddGitpodUserIfNotExists() error {
	ok, err := hasGroup(gitpodGroupName, gitpodGID)
	if err != nil {
		return err
	}
	if !ok {
		err = addGroup(gitpodGroupName, gitpodGID)
		if err != nil {
			return err
		}
	}

	targetUser := &user.User{
		Uid:      strconv.Itoa(gitpodUID),
		Gid:      strconv.Itoa(gitpodGID),
		Username: gitpodUserName,
		HomeDir:  "/home/" + gitpodUserName,
	}
	ok, err = hasUser(targetUser)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}

	return addUser(targetUser)
}

func hasGroup(name string, gid int) (bool, error) {
	grpByName, err := defaultLookup.LookupGroup(name)
	if err == user.UnknownGroupError(name) {
		err = nil
	}
	if err != nil {
		return false, err
	}
	grpByID, err := defaultLookup.LookupGroupId(strconv.Itoa(gid))
	if err == user.UnknownGroupIdError(strconv.Itoa(gid)) {
		err = nil
	}
	if err != nil {
		return false, err
	}

	if grpByID == nil && grpByName == nil {
		// group does not exist
		return false, nil
	}
	if grpByID != nil && grpByName == nil {
		// a group with this GID exists already, but has a different name
		return true, xerrors.Errorf("group %s already uses GID %d", grpByID.Name, gid)
	}
	if grpByID == nil && grpByName != nil {
		// a group with this name already exists, but has a different GID
		return true, xerrors.Errorf("group named %s exists but uses different GID %s", name, grpByName.Gid)
	}

	// group exists and all is well
	return true, nil
}

func hasUser(u *user.User) (bool, error) {
	userByName, err := defaultLookup.Lookup(u.Username)
	if err == user.UnknownUserError(u.Username) {
		err = nil
	}
	if err != nil {
		return false, err
	}
	userByID, err := defaultLookup.LookupId(u.Uid)
	uid, _ := strconv.Atoi(u.Uid)
	if err == user.UnknownUserIdError(uid) {
		err = nil
	}
	if err != nil {
		return false, err
	}

	if userByID == nil && userByName == nil {
		// user does not exist
		return false, nil
	}
	if userByID != nil && userByName == nil {
		// a user with this GID exists already, but has a different name
		return true, xerrors.Errorf("user %s already uses UID %s", userByID.Username, u.Uid)
	}
	if userByID == nil && userByName != nil {
		// a user with this name already exists, but has a different GID
		return true, xerrors.Errorf("user named %s exists but uses different UID %s", u.Username, userByName.Uid)
	}

	// at this point it doesn't matter if we use userByID or byName - they're likely the same
	// because of the way we looked them up.
	existingUser := userByID
	if existingUser.Gid != u.Gid {
		return true, xerrors.Errorf("existing user %s has different GID %s (instead of %s)", existingUser.Username, existingUser.Gid, u.Gid)
	}
	if existingUser.HomeDir != u.HomeDir {
		return true, xerrors.Errorf("existing user %s has different home directory %s (instead of %s)", existingUser.Username, existingUser.HomeDir, u.HomeDir)
	}

	// user exists and all is well
	return true, nil
}

func addGroup(name string, gid int) error {
	flavour := determineAdduserFlavour()
	if flavour == adduserUnknown {
		return xerrors.Errorf("no addgroup command found")
	}

	args := addgroupCommand[flavour](name, gid)
	out, err := exec.Command(args[0], args[1:]...).CombinedOutput()
	if err != nil {
		return xerrors.Errorf("%w: %s", err, string(out))
	}
	log.WithField("args", args).Debug("addgroup")

	return nil
}

func addUser(opts *user.User) error {
	flavour := determineAdduserFlavour()
	if flavour == adduserUnknown {
		return xerrors.Errorf("no adduser command found")
	}

	args := adduserCommand[flavour](opts)
	out, err := exec.Command(args[0], args[1:]...).CombinedOutput()
	if err != nil {
		return xerrors.Errorf("%v: %w: %s", args, err, string(out))
	}
	log.WithField("args", args).Debug("adduser")

	return nil
}

func determineAdduserFlavour() adduserFlavour {
	for flavour, gen := range adduserCommand {
		args := gen(&user.User{})
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

const defaultShell = "/bin/sh"

var adduserCommand = map[adduserFlavour]func(*user.User) []string{
	adduserBusybox: func(opts *user.User) []string {
		return []string{"adduser", "-h", opts.HomeDir, "-s", defaultShell, "-D", "-G", opts.Gid, "-u", opts.Uid, opts.Username}
	},
	adduserDebian: func(opts *user.User) []string {
		return []string{"adduser", "--home", opts.HomeDir, "--shell", defaultShell, "--disabled-login", "--gid", opts.Gid, "--uid", opts.Uid, opts.Username}
	},
	adduserUseradd: func(opts *user.User) []string {
		return []string{"useradd", "-m", "--home-dir", opts.HomeDir, "--shell", defaultShell, "--gid", opts.Gid, "--uid", opts.Uid, opts.Username}
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
