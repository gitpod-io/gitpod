// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"os/user"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestHasUser(t *testing.T) {
	gitpodUser := user.User{Username: gitpodUserName, Uid: strconv.Itoa(gitpodUID), HomeDir: "/home/gitpod", Gid: strconv.Itoa(gitpodGID)}
	mod := func(u user.User, m func(u *user.User)) *user.User {
		m(&u)
		return &u
	}

	type Expectation struct {
		Exists bool
		Error  string
	}
	tests := []struct {
		Name        string
		Ops         ops
		Expectation Expectation
	}{
		{
			Name: "does exist",
			Ops: ops{
				RLookup:   opsResult{User: &gitpodUser},
				RLookupId: opsResult{User: &gitpodUser},
			},
			Expectation: Expectation{Exists: true},
		},
		{
			Name: "does not exist",
			Ops: ops{
				RLookup:   opsResult{Err: user.UnknownUserError(gitpodUserName)},
				RLookupId: opsResult{Err: user.UnknownUserIdError(gitpodUID)},
			},
		},
		{
			Name: "different UID",
			Ops: ops{
				RLookup:   opsResult{User: mod(gitpodUser, func(u *user.User) { u.Uid = "1000" })},
				RLookupId: opsResult{Err: user.UnknownUserIdError(gitpodUID)},
			},
			Expectation: Expectation{
				Exists: true,
				Error:  "user named gitpod exists but uses different UID 1000",
			},
		},
		{
			Name: "different name",
			Ops: ops{
				RLookup:   opsResult{Err: user.UnknownUserError(gitpodUserName)},
				RLookupId: opsResult{User: mod(gitpodUser, func(u *user.User) { u.Username = "foobar" })},
			},
			Expectation: Expectation{
				Exists: true,
				Error:  "user foobar already uses UID 33333",
			},
		},
		{
			Name: "different GID",
			Ops: ops{
				RLookup:   opsResult{User: mod(gitpodUser, func(u *user.User) { u.Gid = "1000" })},
				RLookupId: opsResult{User: mod(gitpodUser, func(u *user.User) { u.Gid = "1000" })},
			},
			Expectation: Expectation{
				Exists: true,
				Error:  "existing user gitpod has different GID 1000 (instead of 33333)",
			},
		},
		{
			Name: "different home dir",
			Ops: ops{
				RLookup:   opsResult{User: mod(gitpodUser, func(u *user.User) { u.HomeDir = "1000" })},
				RLookupId: opsResult{User: mod(gitpodUser, func(u *user.User) { u.HomeDir = "1000" })},
			},
			Expectation: Expectation{
				Exists: true,
				Error:  "existing user gitpod has different home directory 1000 (instead of /home/gitpod)",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			defaultLookup = test.Ops
			exists, err := hasUser(&gitpodUser)
			var act Expectation
			act.Exists = exists
			if err != nil {
				act.Error = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected hasUser (-want +got):\n%s", diff)
			}
		})
	}
}

func TestHasGroup(t *testing.T) {
	gitpodGroup := user.Group{Name: gitpodGroupName, Gid: strconv.Itoa(gitpodGID)}
	mod := func(u user.Group, m func(u *user.Group)) *user.Group {
		m(&u)
		return &u
	}

	type Expectation struct {
		Exists bool
		Error  string
	}
	tests := []struct {
		Name        string
		Ops         ops
		Expectation Expectation
	}{
		{
			Name: "does exist",
			Ops: ops{
				RLookupGroup:   opsResult{Group: &gitpodGroup},
				RLookupGroupId: opsResult{Group: &gitpodGroup},
			},
			Expectation: Expectation{Exists: true},
		},
		{
			Name: "does not exist",
			Ops: ops{
				RLookupGroup:   opsResult{Err: user.UnknownGroupError(gitpodGroupName)},
				RLookupGroupId: opsResult{Err: user.UnknownGroupIdError(gitpodGroup.Gid)},
			},
		},
		{
			Name: "different GID",
			Ops: ops{
				RLookupGroup:   opsResult{Group: mod(gitpodGroup, func(u *user.Group) { u.Gid = "1000" })},
				RLookupGroupId: opsResult{Err: user.UnknownGroupIdError(gitpodGroup.Gid)},
			},
			Expectation: Expectation{
				Exists: true,
				Error:  "group named gitpod exists but uses different GID 1000",
			},
		},
		{
			Name: "different name",
			Ops: ops{
				RLookupGroup:   opsResult{Err: user.UnknownGroupError(gitpodGroupName)},
				RLookupGroupId: opsResult{Group: mod(gitpodGroup, func(u *user.Group) { u.Name = "foobar" })},
			},
			Expectation: Expectation{
				Exists: true,
				Error:  "group foobar already uses GID 33333",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			defaultLookup = test.Ops
			exists, err := hasGroup(gitpodGroupName, gitpodGID)
			var act Expectation
			act.Exists = exists
			if err != nil {
				act.Error = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected hasGroup (-want +got):\n%s", diff)
			}
		})
	}
}

type opsResult struct {
	Group *user.Group
	User  *user.User
	Err   error
}

type ops struct {
	RLookup        opsResult
	RLookupId      opsResult
	RLookupGroup   opsResult
	RLookupGroupId opsResult
}

func (o ops) LookupGroup(name string) (grp *user.Group, err error) {
	return o.RLookupGroup.Group, o.RLookupGroup.Err
}

func (o ops) LookupGroupId(id string) (grp *user.Group, err error) {
	return o.RLookupGroupId.Group, o.RLookupGroupId.Err
}

func (o ops) Lookup(name string) (grp *user.User, err error) {
	return o.RLookup.User, o.RLookup.Err
}

func (o ops) LookupId(id string) (grp *user.User, err error) {
	return o.RLookupId.User, o.RLookupId.Err
}
