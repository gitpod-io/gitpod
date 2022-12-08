// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"os/user"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
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
	if err := addSudoer(gitpodGroupName); err != nil {
		log.WithError(err).Error("add gitpod sudoers")
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
		return true, xerrors.Errorf("group named %s exists but uses different GID %s, should be: %d", name, grpByName.Gid, gitpodGID)
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
		return true, xerrors.Errorf("user named %s exists but uses different UID %s, should be: %d", u.Username, userByName.Uid, gitpodUID)
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
	flavour := determineAddgroupFlavour()
	if flavour == cmdUnknown {
		return xerrors.Errorf("no addgroup command found")
	}

	args := addgroupCommands[flavour](name, gid)
	out, err := exec.Command(args[0], args[1:]...).CombinedOutput()
	if err != nil {
		return xerrors.Errorf("%w: %s", err, string(out))
	}
	log.WithField("args", args).Debug("addgroup")

	return nil
}

func addUser(opts *user.User) error {
	flavour := determineAdduserFlavour()
	if flavour == cmdUnknown {
		return xerrors.Errorf("no adduser command found")
	}

	args := adduserCommands[flavour](opts)
	out, err := exec.Command(args[0], args[1:]...).CombinedOutput()
	if err != nil {
		return xerrors.Errorf("%v: %w: %s", args, err, string(out))
	}
	log.WithField("args", args).Debug("adduser")

	return nil
}

// addSudoer check and add group to /etc/sudoers
func addSudoer(group string) error {
	if group == "" {
		return xerrors.Errorf("group name should not be empty")
	}
	sudoersPath := "/etc/sudoers"
	finfo, err := os.Stat(sudoersPath)
	if err != nil {
		return err
	}
	b, err := ioutil.ReadFile(sudoersPath)
	if err != nil {
		return err
	}
	gitpodSudoer := []byte(fmt.Sprintf("%%%s ALL=NOPASSWD:ALL", group))
	// Line starts with "%gitpod ..."
	re := regexp.MustCompile(fmt.Sprintf("(?m)^%%%s\\s+.*?$", group))
	if len(re.FindStringIndex(string(b))) > 0 {
		nb := re.ReplaceAll(b, gitpodSudoer)
		return os.WriteFile(sudoersPath, nb, finfo.Mode().Perm())
	}
	file, err := os.OpenFile(sudoersPath, os.O_APPEND|os.O_WRONLY, os.ModeAppend)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.Write(append([]byte("\n"), gitpodSudoer...))
	return err
}

func determineCmdFlavour(args []string) bool {
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
		// FIXME: use regexp to fix help with some flags like --global --gid which -g included
		if !strings.Contains(out, f) {
			found = false
			break
		}
	}
	return found
}

func determineAddgroupFlavour() int {
	for flavour, gen := range addgroupCommands {
		args := gen("", 0)
		if determineCmdFlavour(args) {
			return flavour
		}
	}
	return cmdUnknown
}

func determineAdduserFlavour() int {
	for flavour, gen := range adduserCommands {
		args := gen(&user.User{})
		if determineCmdFlavour(args) {
			return flavour
		}
	}
	return cmdUnknown
}

const (
	cmdUnknown = -1
)

const defaultShell = "/bin/sh"

var adduserCommands = []func(*user.User) []string{
	func(opts *user.User) []string {
		return []string{"adduser", "--home", opts.HomeDir, "--shell", defaultShell, "--disabled-login", "--gid", opts.Gid, "--uid", opts.Uid, opts.Username}
	}, // Debian
	func(opts *user.User) []string {
		return []string{"adduser", "-h", opts.HomeDir, "-s", defaultShell, "-D", "-G", opts.Gid, "-u", opts.Uid, opts.Username}
	}, // Busybox
	func(opts *user.User) []string {
		return []string{"useradd", "-m", "--home-dir", opts.HomeDir, "--shell", defaultShell, "--gid", opts.Gid, "--uid", opts.Uid, opts.Username}
	}, // Useradd
}

// addgroupCommands check long flag first to avoid --gid contains -g which -g flag doesn't realy exist
var addgroupCommands = []func(name string, gid int) []string{
	func(name string, gid int) []string { return []string{"addgroup", "--gid", strconv.Itoa(gid), name} }, // Debian
	func(name string, gid int) []string { return []string{"groupadd", "--gid", strconv.Itoa(gid), name} }, // Useradd
	func(name string, gid int) []string { return []string{"addgroup", "-g", strconv.Itoa(gid), name} },    // Busybox
}
