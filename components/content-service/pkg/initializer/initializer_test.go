// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"

	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

var doExecute = flag.Bool("execute", false, "actually execute a testcase")

var (
	OwnedByRoot TestWorkspace = []TestWorkspaceEntry{
		// regular files with decent permissions
		{"foo", File, 0, 0, 0644, ""},
		{"bar", File, 0, 0, 0644, ""},

		// nested folders and files
		{"/one/level", Dir, 0, 0, 0744, ""},
		{"/one/level/file", File, 0, 0, 0744, ""},
		{"/two/levels/down", File, 0, 0, 0644, ""},

		// folders owned by root with improper permissions, and their childen
		{"/subdir", Dir, 0, 0, 0700, ""},
		{"/subdir/content", File, 0, 0, 0600, ""},

		// circular symlinks
		{"/linktgt-root", Dir, 0, 0, 0744, ""},
		{"/linktgt-root/self-root", Symlink, 0, 0, 0, "/linktgt-root"},
	}

	OwnedByGitpod TestWorkspace = []TestWorkspaceEntry{
		// regular files with decent permissions
		{"foo", File, GitpodUID, GitpodGID, 0644, ""},
		{"bar", File, GitpodUID, GitpodGID, 0644, ""},

		// nested folders and files
		{"/one/level", Dir, GitpodUID, GitpodGID, 0744, ""},
		{"/one/level/file", File, GitpodUID, GitpodGID, 0744, ""},
		{"/two/levels/down", File, GitpodUID, GitpodGID, 0744, ""},

		// folders owned by gitpod with improper permissions, and their childen
		{"/subdir", Dir, GitpodUID, GitpodGID, 0700, ""},
		{"/subdir/content", File, GitpodUID, GitpodGID, 0600, ""},

		// circular symlinks
		{"/linktgt-gitpod", Dir, GitpodUID, GitpodUID, 00755, ""},
		{"/linktgt-gitpod/self-gitpod", Symlink, GitpodUID, GitpodGID, 0, "/linktgt-gitpod"},
	}

	OwnedByMixed TestWorkspace = []TestWorkspaceEntry{
		// regular files with decent permissions
		{"foo-root", File, 0, 0, 0644, ""},
		{"foo-gitpod", File, GitpodUID, GitpodGID, 0644, ""},

		// nested folders and files
		{"/one/root", File, 0, 0, 0644, ""},
		{"/one/gitpod", File, GitpodUID, GitpodGID, 0644, ""},
		{"/two/levels/root", File, 0, 0, 0644, ""},
		{"/two/levels/gitpod", File, GitpodUID, GitpodGID, 0644, ""},

		// hidden files and folders
		{"/.hidden-root/.content", File, 0, 0, 0755, ""},
		{"/.hidden-gitpod", Dir, GitpodUID, GitpodGID, 0744, ""},
		{"/.hidden-gitpod/.gitpod", File, GitpodUID, GitpodGID, 0744, ""},
		{"/.hidden-gitpod/.root", File, 0, 0, 0744, ""},

		// folders owned by root with improper permissions, and their childen
		{"/subdir-root", Dir, 0, 0, 0600, ""},
		{"/subdir-gitpod", Dir, GitpodUID, GitpodGID, 0600, ""},
		{"/subdir-root/root", File, 0, 0, 0600, ""},
		{"/subdir-root/gitpod", File, GitpodUID, GitpodGID, 0600, ""},
		{"/subdir-gitpod/root", File, 0, 0, 0600, ""},
		{"/subdir-gitpod/gitpod", File, GitpodUID, GitpodGID, 0600, ""},

		// circular symlinks
		{"/linktgt-root", Dir, 0, 0, 0755, ""},
		{"/linktgt-root/self-root", Symlink, 0, 0, 0, "/linktgt-root"},
		{"/linktgt-root/self-gitpod", Symlink, GitpodUID, GitpodGID, 0, "/linktgt-root"},
		{"/linktgt-gitpod", Dir, GitpodUID, GitpodGID, 0755, ""},
		{"/linktgt-gitpod/self-root", Symlink, 0, 0, 0, "/linktgt-gitpod"},
		{"/linktgt-gitpod/self-gitpod", Symlink, GitpodUID, GitpodGID, 0, "/linktgt-gitpod"},
	}
)

func init() {
	logrus.SetLevel(logrus.DebugLevel)
}

func TestInitFromBackup(t *testing.T) {
	if !checkTestPrerequisites(t) {
		return
	}

	MessedUpPermissions := TestWorkspace{
		TestWorkspaceEntry{"/folder", Dir, GitpodUID, GitpodGID, 0400, ""},
		TestWorkspaceEntry{"/folder/file", File, GitpodUID, GitpodGID, 0400, ""},
		TestWorkspaceEntry{"/folder/really-broken-file", File, GitpodUID, GitpodGID, 0000, ""},
		TestWorkspaceEntry{"/maybe-broken/file", File, GitpodUID, GitpodGID, 0444, ""},
		TestWorkspaceEntry{"/broken-folder", Dir, GitpodUID, GitpodGID, 0000, ""},
		TestWorkspaceEntry{"/broken-folder/child", File, GitpodUID, GitpodGID, 0000, ""},
	}
	MixedOwnersMessedUpPermissions := append(append(TestWorkspace{
		TestWorkspaceEntry{"/root-broken-folder", Dir, 0, 0, 0000, ""},
		TestWorkspaceEntry{"/root-broken-folder/child", File, 0, 0, 0000, ""},
		TestWorkspaceEntry{"/root-maybe-broken/file", File, 0, 0, 0444, ""},
	}, MessedUpPermissions...), OwnedByMixed...)

	testcases := map[string]initFromBackupTestcase{
		"valid":                            {Workspace: OwnedByGitpod},
		"invalid-messedUpPermissions":      {Workspace: MessedUpPermissions},
		"invalid-mixedMessedUpPermissions": {Workspace: MixedOwnersMessedUpPermissions},
		"invalid-root":                     {Workspace: OwnedByMixed},
		"invalid-mixed":                    {Workspace: OwnedByMixed},
		"invalid-gh2428": {Workspace: TestWorkspace{
			TestWorkspaceEntry{"/folder", Dir, GitpodUID, GitpodGID, 0500, ""},
			TestWorkspaceEntry{"/folder/fuzz", Dir, GitpodUID, GitpodGID, 0500, ""},
			TestWorkspaceEntry{"/folder/fuzz/file", File, GitpodUID, GitpodGID, 0500, ""},
			TestWorkspaceEntry{"/folder/file", File, GitpodUID, GitpodGID, 0500, ""},
		}},
	}

	if *doExecute {
		testname := flag.Arg(0)
		tc, ok := testcases[testname]
		if !ok {
			t.Errorf("unknown testcase %s", testname)
			return
		}

		err := tc.Run(t, testname)
		if err != nil {
			t.Errorf("%+v", err)
		}
		return
	}

	for tcn := range testcases {
		callSelf(t, "TestInitFromBackup", tcn)
	}
}

type initFromBackupTestcase struct {
	Workspace TestWorkspace
}

func (tc initFromBackupTestcase) Run(t *testing.T, name string) error {
	workdir, err := tc.Workspace.Materialize()
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	if !tc.Workspace.ValidateMaterialization(t, workdir) {
		return xerrors.Errorf("invalid materialization")
	}
	t.Logf("%s: created workdir in %s", name, workdir)

	factory := &ArchiveFactory{}
	fixture, err := factory.Build(workdir)
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	t.Logf("%s: created fixture in %s", name, fixture)

	target, err := ioutil.TempDir("", "target-")
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	t.Logf("%s: created target in %s", name, target)
	target = filepath.Join(target, "ws")

	storage := mockGCloudStorage{
		Fixture: fixture,
		Delegate: &storage.DirectGCPStorage{
			WorkspaceName: "foobar",
			Stage:         storage.StageDevStaging,
		},
	}

	src, err := InitializeWorkspace(context.Background(), target, &storage, nil)
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}

	tc.Workspace.ValidateInitResult(t, name, target, true, "")

	if src != csapi.WorkspaceInitFromBackup {
		t.Errorf("%s: init reported that no backup was found", name)
	}

	return nil
}

func TestInitFromGit(t *testing.T) {
	if !checkTestPrerequisites(t) {
		return
	}

	testcases := map[string]testInitFromGitTestcase{
		"valid-remote-head":   {OwnedByGitpod, "master", RemoteHead, "foobar"},
		"valid-remote-branch": {OwnedByGitpod, "after-commit", RemoteBranch, "foobar"},
		"valid-local-branch":  {OwnedByGitpod, "local-branch", LocalBranch, "foobar"},
	}

	if *doExecute {
		testname := flag.Arg(0)
		tc, ok := testcases[testname]
		if !ok {
			t.Errorf("unknown testcase %s", testname)
			return
		}

		err := tc.Run(t, testname)
		if err != nil {
			t.Errorf("%+v", err)
		}
		return
	}

	for tcn := range testcases {
		callSelf(t, "TestInitFromGit", tcn)
	}
}

type testInitFromGitTestcase struct {
	Workspace        TestWorkspace
	CloneTarget      string
	TargetMode       CloneTargetMode
	CheckoutLocation string
}

func (tc testInitFromGitTestcase) Run(t *testing.T, name string) error {
	workdir, err := tc.Workspace.Materialize()
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	if !tc.Workspace.ValidateMaterialization(t, workdir) {
		return xerrors.Errorf("invalid materialization")
	}

	factory := &GitFactory{}
	fixture, err := factory.Build(workdir)
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	t.Logf("%s: created fixture in %s", name, fixture)

	target, err := ioutil.TempDir("", "target-")
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	t.Logf("%s: created target in %s", name, target)
	target = filepath.Join(target, "ws")

	initializer := &GitInitializer{
		Client: git.Client{
			Location:  filepath.Join(target, tc.CheckoutLocation),
			RemoteURI: fmt.Sprintf("file://%s", fixture),
		},
		CloneTarget: tc.CloneTarget,
		TargetMode:  tc.TargetMode,
	}

	_, err = InitializeWorkspace(context.Background(), target, &storage.DirectNoopStorage{}, WithInitializer(initializer), WithCleanSlate)
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}

	tc.Workspace.ValidateInitResult(t, name, target, true, tc.CheckoutLocation)

	return nil
}

func TestInitFromSnapshot(t *testing.T) {
	if !checkTestPrerequisites(t) {
		return
	}

	testcases := map[string]testInitFromSnapshotTestcase{
		"valid-snapshot":   {OwnedByGitpod},
		"invalid-snapshot": {OwnedByRoot},
	}

	if *doExecute {
		testname := flag.Arg(0)
		tc, ok := testcases[testname]
		if !ok {
			t.Errorf("unknown testcase %s", testname)
			return
		}

		err := tc.Run(t, testname)
		if err != nil {
			t.Errorf("%+v", err)
		}
		return
	}

	for tcn := range testcases {
		callSelf(t, "TestInitFromSnapshot", tcn)
	}
}

type testInitFromSnapshotTestcase struct {
	Workspace TestWorkspace
}

func (tc testInitFromSnapshotTestcase) Run(t *testing.T, name string) error {
	workdir, err := tc.Workspace.Materialize()
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	if !tc.Workspace.ValidateMaterialization(t, workdir) {
		return xerrors.Errorf("invalid materialization")
	}

	factory := &ArchiveFactory{}
	fixture, err := factory.Build(workdir)
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	t.Logf("%s: created fixture in %s", name, fixture)

	target, err := ioutil.TempDir("", "target-")
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	t.Logf("%s: created target in %s", name, target)
	target = filepath.Join(target, "ws")

	initializer := &SnapshotInitializer{
		Location: target,
		Snapshot: "does-not-matter@valid-snapshot-fqn",
		Storage: &mockGCloudStorage{
			Fixture: fixture,
			Delegate: &storage.DirectGCPStorage{
				WorkspaceName: "foobar",
				Stage:         storage.StageDevStaging,
			},
		},
	}

	_, err = InitializeWorkspace(context.Background(), target, &storage.DirectNoopStorage{}, WithInitializer(initializer), WithCleanSlate)
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}

	tc.Workspace.ValidateInitResult(t, name, target, true, "")

	return nil
}

func TestInitFromPrebuild(t *testing.T) {
	if !checkTestPrerequisites(t) {
		return
	}

	testcases := map[string]testInitFromPrebuildTestcase{
		"with-root":                {OwnedByRoot, false, "", RemoteHead},
		"with-root-and-gitremote":  {OwnedByRoot, false, "after-commit", RemoteHead},
		"with-root-and-gitlocal":   {OwnedByRoot, false, "new-branch", LocalBranch},
		"with-root-gitfallback":    {OwnedByRoot, true, "master", RemoteHead},
		"with-gitpod":              {OwnedByGitpod, false, "", RemoteHead},
		"with-mixture":             {OwnedByMixed, false, "", RemoteHead},
		"with-mixture-gitfallback": {OwnedByMixed, true, "master", RemoteHead},
	}

	if *doExecute {
		testname := flag.Arg(0)
		tc, ok := testcases[testname]
		if !ok {
			t.Errorf("unknown testcase %s", testname)
			return
		}

		err := tc.Run(t, testname)
		if err != nil {
			t.Errorf("%+v", err)
		}
		return
	}

	for tcn := range testcases {
		callSelf(t, "TestInitFromPrebuild", tcn)
	}
}

type testInitFromPrebuildTestcase struct {
	Workspace     TestWorkspace
	BreakSnapshot bool
	CloneTarget   string
	TargetMode    CloneTargetMode
}

func (tc testInitFromPrebuildTestcase) Run(t *testing.T, name string) error {
	workdir, err := tc.Workspace.Materialize()
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	if !tc.Workspace.ValidateMaterialization(t, workdir) {
		return xerrors.Errorf("invalid materialization")
	}
	t.Logf("%s: created workdir in %s", name, workdir)

	checkoutLocation := "project"
	factory := &GitArchiveFactory{
		ArchiveFactory: ArchiveFactory{
			Prefix: fmt.Sprintf("%s/", checkoutLocation),
		},
	}
	fixture, err := factory.Build(workdir)
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	t.Logf("%s: created fixture in %s", name, fixture)

	if tc.BreakSnapshot {
		// sabotage the tar file
		err := ioutil.WriteFile(fixture, []byte{}, 0644)
		if err != nil {
			return xerrors.Errorf("%s: %w", name, err)
		}
	}

	target, err := ioutil.TempDir("", "target-")
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}
	t.Logf("%s: created target in %s", name, target)
	target = filepath.Join(target, "ws")

	initializer := &PrebuildInitializer{
		Git: &GitInitializer{
			Client: git.Client{
				Location:  filepath.Join(target, checkoutLocation),
				RemoteURI: fmt.Sprintf("file://%s", workdir),
			},
			CloneTarget: tc.CloneTarget,
			TargetMode:  tc.TargetMode,
		},
		Prebuild: &SnapshotInitializer{
			Location: filepath.Join(target, checkoutLocation),
			Snapshot: "does-not-matter@valid-fqn",
			Storage: &mockGCloudStorage{
				Fixture: fixture,
				Delegate: &storage.DirectGCPStorage{
					WorkspaceName: "foobar",
					Stage:         storage.StageDevStaging,
				},
			},
		},
	}

	_, err = InitializeWorkspace(context.Background(), target, &storage.DirectNoopStorage{}, WithInitializer(initializer), WithCleanSlate)
	if err != nil {
		return xerrors.Errorf("%s: %w", name, err)
	}

	tc.Workspace.ValidateInitResult(t, name, target, true, checkoutLocation)

	return nil
}

func callSelf(t *testing.T, testname, casename string) {
	t.Run(testname, func(t *testing.T) {
		args := []string{}
		if testing.Verbose() {
			args = append(args, "-test.v")
		}
		args = append(args, "-test.run", testname, "-execute", casename)

		cmd := exec.Command(os.Args[0], args...)
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Errorf("%s: %s", casename, out)
		}
	})
}

func checkTestPrerequisites(t *testing.T) bool {
	uid := syscall.Geteuid()
	if uid != 0 {
		t.Skipf("must run this test with UID 0, not %d", uid)
		return false
	}

	tarVariant := detectTarVariant()
	if tarVariant != BusyboxTar {
		t.Skipf("wrong tar variant: %v instead of %v", tarVariant, BusyboxTar)
		return false
	}

	return true
}

type TestWorkspaceEntry struct {
	Location string
	Kind     TestWorkspaceEntryKind
	OwnerUID int
	OwnerGID int
	Mode     os.FileMode
	Content  string
}

type TestWorkspace []TestWorkspaceEntry

type TestWorkspaceEntryKind int

const (
	File TestWorkspaceEntryKind = iota
	Dir
	Symlink
)

func (layout TestWorkspace) Materialize() (string, error) {
	workdir, err := ioutil.TempDir("", "test")
	if err != nil {
		return "", xerrors.Errorf("cannot create workdir: %w", err)
	}

	for _, w := range layout {
		// make parent structure
		segments := strings.Split(w.Location, string(filepath.Separator))
		parentSegments := segments[:len(segments)-1]
		p := workdir
		for _, seg := range parentSegments {
			if seg == "" {
				continue
			}

			p = filepath.Join(p, seg)
			if _, err := os.Stat(p); err == nil {
				// path exists already, we're done here
				break
			}

			err := os.Mkdir(p, w.Mode)
			if err != nil {
				return "", xerrors.Errorf("cannot create dir %s: %w", p, err)
			}

			err = os.Chown(p, w.OwnerUID, w.OwnerGID)
			if err != nil {
				return "", xerrors.Errorf("cannot chown dir %s: %w", p, err)
			}
		}

		fn := filepath.Join(workdir, w.Location)
		switch w.Kind {
		case File:
			content := w.Content
			if content == "" {
				content = createRandomContent()
			}
			err := ioutil.WriteFile(fn, []byte(content), w.Mode)
			if err != nil {
				return "", xerrors.Errorf("cannot create file %s: %w", fn, err)
			}
		case Dir:
			err := os.Mkdir(fn, w.Mode)
			if err != nil {
				return "", xerrors.Errorf("cannot create dir %s: %w", fn, err)
			}
		case Symlink:
			err := os.Symlink(filepath.Join(workdir, w.Content), fn)
			if err != nil {
				return "", xerrors.Errorf("cannot create symlink %s: %w", fn, err)
			}

			if w.Mode != 0 {
				return "", xerrors.Errorf("%s: symlink entries cannot have mode != 0", fn)
			}
		}

		// DO NOT use os.Chown here as that would change the target in case of symlinks
		err := os.Lchown(fn, w.OwnerUID, w.OwnerGID)
		if err != nil {
			return "", xerrors.Errorf("cannot chown test workspace entry %s: %w", fn, err)
		}
	}

	return workdir, nil
}

func (layout TestWorkspace) ValidateMaterialization(t *testing.T, workdir string) bool {
	for _, e := range layout {
		ostat, err := os.Lstat(filepath.Join(workdir, e.Location))
		if err != nil {
			t.Errorf("%s: %v", e.Location, err)
			continue
		}

		if e.Kind != Dir && ostat.IsDir() {
			t.Errorf("%s is a directory, but not sould not be one", e.Location)
		}
		if e.Kind == Dir && !ostat.IsDir() {
			t.Errorf("%s is a directory, but not sould be one", e.Location)
		}

		// check permissions for any non-symlink - symlinks can only ever have 777
		if e.Kind != Symlink && ostat.Mode().Perm() != e.Mode.Perm() {
			t.Errorf("%s has wrong mode: %#o instead of %#o", e.Location, ostat.Mode().Perm(), e.Mode.Perm())
		}

		stat := ostat.Sys().(*syscall.Stat_t)
		if stat.Uid != uint32(e.OwnerUID) || stat.Gid != uint32(e.OwnerGID) {
			t.Errorf("%s is not owned by %d:%d but %d:%d", e.Location, e.OwnerUID, e.OwnerGID, stat.Uid, stat.Gid)
		}
	}
	return !t.Failed()
}

func (layout TestWorkspace) ValidateInitResult(t *testing.T, name, target string, expectWorkspace bool, workspacePrefix string) {
	err := filepath.Walk(target, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			t.Errorf("post-init %s: %+v", name, err)
			return nil
		}

		stat := info.Sys().(*syscall.Stat_t)
		if stat.Uid != GitpodUID || stat.Gid != GitpodGID {
			t.Errorf("post-init: %s is not owned by gitpod user but %d:%d", path, stat.Uid, stat.Gid)
		}

		return nil
	})
	if err != nil {
		t.Errorf("post-init: %v", err)
	}

	if !expectWorkspace {
		return
	}

	for _, e := range layout {
		fn := filepath.Join(target, e.Location)
		if workspacePrefix != "" {
			fn = filepath.Join(target, workspacePrefix, e.Location)
		}
		ostat, err := os.Lstat(fn)
		if os.IsNotExist(err) {
			t.Errorf("post-init: %s does not exist", e.Location)
			continue
		}
		if err != nil {
			t.Errorf("post-init: %s: %v", e.Location, err)
			continue
		}

		actualKind := File
		if ostat.IsDir() {
			actualKind = Dir
		}
		if ostat.Mode()&os.ModeSymlink == os.ModeSymlink {
			actualKind = Symlink
		}

		if actualKind != e.Kind {
			t.Errorf("post-init: %s is of wrong kind: %v instead of %v", e.Location, actualKind, e.Kind)
		}
	}
}

type ArchiveFactory struct {
	Prefix string
}

func (m *ArchiveFactory) Build(workdir string) (fixture string, err error) {
	archiveFile, err := ioutil.TempFile("", "testarchive*.tar")
	if err != nil {
		return "", xerrors.Errorf("cannot create tempfile for archive test workspace: %w", err)
	}

	// this is just to help debugging but doesn't really affect the test - if it fails that's not a reason to fail the test
	err = os.Chmod(archiveFile.Name(), 0777)
	if err != nil {
		return "", xerrors.Errorf("cannot chmod tempfile for archive test workspace: %w", err)
	}

	tarexec := "tar"
	args := []string{"-cf", archiveFile.Name(), "."}
	if m.Prefix != "" {
		if detectTarVariant() != GnuTar {
			// heuristic fallback
			if _, err := os.Stat("/bin/tar.gnu"); err == nil {
				fmt.Println("falling back to GNU tar because of the prefix")
				tarexec = "/bin/tar.gnu"
			} else {
				return "", xerrors.Errorf("prefix is only supported with GNU tar")
			}
		}

		args = append([]string{"--transform", fmt.Sprintf("s,^./,%s,S", m.Prefix)}, args...)
	}
	cmd := exec.Command(tarexec, args...)
	cmd.Dir = workdir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", xerrors.Errorf("tar %s (%v): %s", strings.Join(args, " "), err, out)
	}

	return archiveFile.Name(), nil
}

type GitFactory struct{}

func (m *GitFactory) Build(workdir string) (fixture string, err error) {
	err = runGit(workdir, "init")
	if err != nil {
		return "", xerrors.Errorf("cannot create test workspace: %w", err)
	}
	err = runGit(workdir, "add", ".")
	if err != nil {
		return "", xerrors.Errorf("cannot create test workspace: %w", err)
	}
	err = runGit(workdir, "commit", "-a", "-m", "initial commit")
	if err != nil {
		return "", xerrors.Errorf("cannot create test workspace: %w", err)
	}
	err = runGit(workdir, "branch", "after-commit")
	if err != nil {
		return "", xerrors.Errorf("cannot create test workspace: %w", err)
	}

	// just to make sure that our "Git repo" can be read by any user during the test, we chmod it to 777
	_, err = exec.Command("chmod", "-R", "777", workdir).CombinedOutput()
	if err != nil {
		return "", xerrors.Errorf("cannot chmod test workspace: %w", err)
	}

	return workdir, nil
}

type GitArchiveFactory struct {
	GitFactory
	ArchiveFactory
}

func (m *GitArchiveFactory) Build(workdir string) (fixture string, err error) {
	fixture, err = m.GitFactory.Build(workdir)
	if err != nil {
		return
	}

	err = runGit(workdir, "remote", "add", "origin", fmt.Sprintf("file://%s", workdir))
	if err != nil {
		return
	}

	fixture, err = m.ArchiveFactory.Build(fixture)
	if err != nil {
		return
	}

	return fixture, nil
}

func runGit(cwd string, args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = cwd
	out, err := cmd.CombinedOutput()
	if err != nil {
		return xerrors.Errorf("git %s: %s", strings.Join(args, " "), out)
	}
	return nil
}

func createRandomContent() string {
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ")
	n := 1025

	rand.Seed(time.Now().UnixNano())
	b := make([]rune, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

type mockGCloudStorage struct {
	Delegate *storage.DirectGCPStorage
	Fixture  string
}

// Init does nothing
func (rs *mockGCloudStorage) Init(ctx context.Context, owner, workspace string) error {
	return rs.Delegate.Init(ctx, owner, workspace)
}

// EnsureExists does nothing
func (rs *mockGCloudStorage) EnsureExists(ctx context.Context) error {
	return nil
}

// DownloadLatestWsSnapshot always returns false and does nothing
func (rs *mockGCloudStorage) DownloadLatestWsSnapshot(ctx context.Context, destination string, name string) (bool, error) {
	rs.Delegate.ObjectAccess = func(ctx context.Context, bkt, obj string) (io.ReadCloser, bool, error) {
		log.WithField("fixture", rs.Fixture).Debug("intercepting object access")
		f, err := os.OpenFile(rs.Fixture, os.O_RDONLY, 0644)
		return f, false, err
	}

	return rs.Delegate.DownloadLatestWsSnapshot(ctx, destination, name)
}

// DownloadLatestWsSnapshot always returns false and does nothing
func (rs *mockGCloudStorage) DownloadWsSnapshot(ctx context.Context, destination string, name string) (bool, error) {
	rs.Delegate.ObjectAccess = func(ctx context.Context, bkt, obj string) (io.ReadCloser, bool, error) {
		f, err := os.OpenFile(rs.Fixture, os.O_RDONLY, 0644)
		return f, false, err
	}

	return rs.Delegate.DownloadWsSnapshot(ctx, destination, name)
}

func (rs *mockGCloudStorage) QualifyWsSnapshot(name string) string {
	return rs.Delegate.QualifyWsSnapshot(name)
}

// UploadWsSnapshot does nothing
func (rs *mockGCloudStorage) UploadWsSnapshot(ctx context.Context, source string, name string, opts ...storage.UploadOption) (string, string, error) {
	return "", "", xerrors.Errorf("not supported")
}

func detectTarVariant() TarVariant {
	output, _ := exec.Command("tar", "--help").CombinedOutput()
	lines := strings.Split(string(output), "\n")

	if len(lines) > 0 && strings.HasPrefix(lines[0], "BusyBox") {
		return BusyboxTar
	}
	if len(lines) > 1 && strings.HasPrefix(lines[1], "GNU 'tar'") {
		return GnuTar
	}

	return UnknownTar
}

type TarVariant string

const (
	UnknownTar TarVariant = ""
	GnuTar     TarVariant = "gnu"
	BusyboxTar TarVariant = "busybox"
)
