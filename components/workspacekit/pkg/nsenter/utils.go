// +build linux

package nsenter

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strconv"

	"golang.org/x/sys/unix"
)

type ModuleXXX interface {
	Run([]byte)
}

type RunFunc func([]byte) string

var modules map[string]RunFunc

func RegisterModule(name string, f RunFunc) bool {
	if modules == nil {
		modules = map[string]RunFunc{}
	}
	modules[name] = f
	return true
}

// Init checks if the process has re-executed itself and must run a registered
// module. Init() needs to be called explicitely from main() to ensure it is
// called after all other init() functions.
func Init() {
	if len(os.Args) < 2 || os.Args[1] != "-init" {
		return
	}

	defer os.Exit(0)

	str := os.Getenv("_LIBNSENTER_COMMAND")
	if str == "" {
		fmt.Printf("Invalid call to init\n")
		os.Exit(1)
	}
	jsonBlob, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		fmt.Println("error:", err)
		os.Exit(1)
	}

	type module struct {
		Module string `json:"module,omitempty"`
	}

	var m module
	err = json.Unmarshal(jsonBlob, &m)
	if err != nil {
		fmt.Println("error:", err)
		os.Exit(1)
	}

	f, ok := modules[m.Module]
	if !ok {
		fmt.Printf("error: module %q not registered\n", m.Module)
		os.Exit(1)
	}
	output := f(jsonBlob)
	fmt.Printf("%s", output)
}

// OpenNamespaces opens a namespace file. It is done separately to Run() so
// that the caller can call libseccomp.NotifIDValid() in between.
func OpenNamespace(pid uint32, nstype string) (*os.File, error) {
	nspath := fmt.Sprintf("/proc/%d/ns/%s", pid, nstype)
	return os.OpenFile(nspath, os.O_RDONLY, 0)
}

// OpenRoot opens a /proc/pid/root file. It is done separately to Run() so
// that the caller can call libseccomp.NotifIDValid() in between.
func OpenRoot(pid uint32) (*os.File, error) {
	path := fmt.Sprintf("/proc/%d/root", pid)
	return os.OpenFile(path, unix.O_PATH, 0)
}

// OpenCwd opens a /proc/pid/cwd file. It is done separately to Run() so
// that the caller can call libseccomp.NotifIDValid() in between.
func OpenCwd(pid uint32) (*os.File, error) {
	path := fmt.Sprintf("/proc/%d/cwd", pid)
	return os.OpenFile(path, unix.O_PATH, 0)
}

// Run executes a module in other namespaces
func Run(root, cwd, mntns, netns, pidns *os.File, i interface{}) ([]byte, error) {
	b, err := json.Marshal(i)
	if err != nil {
		return nil, fmt.Errorf("Unable to encode interface: %s", err)
	}

	stdioFdCount := 3
	cmd := exec.Command("/proc/self/exe", "-init")
	cmd.Env = append(cmd.Env, "_LIBNSENTER_INIT=1")

	if root != nil {
		cmd.ExtraFiles = append(cmd.ExtraFiles, root)
		cmd.Env = append(cmd.Env, "_LIBNSENTER_ROOTFD="+strconv.Itoa(stdioFdCount+len(cmd.ExtraFiles)-1))
	}
	if cwd != nil {
		cmd.ExtraFiles = append(cmd.ExtraFiles, cwd)
		cmd.Env = append(cmd.Env, "_LIBNSENTER_CWDFD="+strconv.Itoa(stdioFdCount+len(cmd.ExtraFiles)-1))
	}
	if mntns != nil {
		cmd.ExtraFiles = append(cmd.ExtraFiles, mntns)
		cmd.Env = append(cmd.Env, "_LIBNSENTER_MNTNSFD="+strconv.Itoa(stdioFdCount+len(cmd.ExtraFiles)-1))
	}
	if netns != nil {
		cmd.ExtraFiles = append(cmd.ExtraFiles, netns)
		cmd.Env = append(cmd.Env, "_LIBNSENTER_NETNSFD="+strconv.Itoa(stdioFdCount+len(cmd.ExtraFiles)-1))
	}
	if pidns != nil {
		cmd.ExtraFiles = append(cmd.ExtraFiles, pidns)
		cmd.Env = append(cmd.Env, "_LIBNSENTER_PIDNSFD="+strconv.Itoa(stdioFdCount+len(cmd.ExtraFiles)-1))
	}

	cmd.Env = append(cmd.Env, "_LIBNSENTER_COMMAND="+base64.StdEncoding.EncodeToString(b))

	stdoutStderr, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("Unable to start the init command: %s\n%s\n", err, stdoutStderr)
	}
	idx := bytes.Index(stdoutStderr, []byte{0})
	if idx == -1 {
		return stdoutStderr, nil
	} else {
		return stdoutStderr[idx+1:], nil
	}
}
