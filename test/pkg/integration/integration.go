// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/rpc"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/client-go/transport/spdy"

	// most of our infra runs on GCP, so it's handy to bake GCP auth support right in
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
)

const cfgFlagDefault = "$HOME/.kube/config"

var (
	cfgFlag       = flag.String("kubeconfig", cfgFlagDefault, "path to the kubeconfig file, use \"in-cluster\" to make use of in cluster Kubernetes config")
	namespaceFlag = flag.String("namespace", "", "namespace to execute the test against. Defaults to the one configured in \"kubeconfig\".")
	usernameFlag  = flag.String("username", "", "username to execute the tests with. Chooses one automatically if left blank.")
)

// NewTest produces a new integration test instance
func NewTest(t *testing.T, timeout time.Duration) (*Test, context.Context) {
	flag.Parse()
	kubeconfig := *cfgFlag
	namespaceOverride := *namespaceFlag
	username := *usernameFlag

	if kubeconfig == cfgFlagDefault {
		home, err := os.UserHomeDir()
		if err != nil {
			t.Fatal("cannot determine user home dir", err)
		}
		kubeconfig = filepath.Join(home, ".kube", "config")
	} else if kubeconfig == "in-cluster" {
		kubeconfig = ""
	}

	restConfig, ns, err := getKubeconfig(kubeconfig)
	if err != nil {
		t.Fatal("cannot load kubeconfig", err)
	}
	client, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		t.Fatal("cannot connecto Kubernetes", err)
	}

	if namespaceOverride != "" {
		ns = namespaceOverride
	}

	ctx, ctxCancel := context.WithTimeout(context.Background(), timeout)
	return &Test{
		t:          t,
		clientset:  client,
		restConfig: restConfig,
		namespace:  ns,
		ctx:        ctx,
		ctxCancel:  ctxCancel,
		username:   username,
	}, ctx
}

// GetKubeconfig loads kubernetes connection config from a kubeconfig file
func getKubeconfig(kubeconfig string) (res *rest.Config, namespace string, err error) {
	if kubeconfig == "" {
		res, err = rest.InClusterConfig()
		if err != nil {
			return
		}

		var data []byte
		data, err = os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
		if err != nil {
			return
		}
		namespace = strings.TrimSpace(string(data))
		return
	}

	cfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfig},
		&clientcmd.ConfigOverrides{},
	)
	namespace, _, err = cfg.Namespace()
	if err != nil {
		return nil, "", err
	}

	res, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, namespace, err
	}

	return res, namespace, nil
}

// Test encapsulates integration test functionality
type Test struct {
	t          *testing.T
	clientset  kubernetes.Interface
	restConfig *rest.Config
	namespace  string
	ctx        context.Context

	closer    []func() error
	ctxCancel func()
	api       *ComponentAPI

	// username contains the string passed to the test per flag. Might be empty.
	username string
}

// Done must be called after the test has run. It cleans up instrumentation
// and modifications made by the test.
func (it *Test) Done() {
	it.ctxCancel()

	// Much "defer", we run the closer in reversed order. This way, we can
	// append to this list quite naturally, and still break things down in
	// the correct order.
	for i := len(it.closer) - 1; i >= 0; i-- {
		err := it.closer[i]()
		if err != nil {
			it.t.Logf("cleanup failed: %q", err)
		}
	}
}

// Username returns the username passed to the test per flag. Might be empty.
func (it *Test) Username() string {
	return it.username
}

// InstrumentOption configures an Instrument call
type InstrumentOption func(*instrumentOptions) error

type instrumentOptions struct {
	SPO              selectPodOptions
	WorkspacekitLift bool
}

type selectPodOptions struct {
	InstanceID string

	Container string
}

// WithInstanceID provides a hint during pod selection for Instrument.
// When instrumenting ws-daemon, we try to select the daemon on the node where the workspace is located.
// When instrumenting the workspace, we select the workspace based on the instance ID.
// For all other component types, this hint is ignored.
func WithInstanceID(instanceID string) InstrumentOption {
	return func(io *instrumentOptions) error {
		io.SPO.InstanceID = instanceID
		return nil
	}
}

// Container provides a hint during pod selection for Instrument a particular container
func WithContainer(container string) InstrumentOption {
	return func(io *instrumentOptions) error {
		io.SPO.Container = container
		return nil
	}
}

// WithWorkspacekitLift executes the agent using `workspacekit lift` thereby lifting it into ring1.
// Only relevant for ComponentWorkspace and ignored for all other components.
// Defaults to true.
func WithWorkspacekitLift(lift bool) InstrumentOption {
	return func(io *instrumentOptions) error {
		io.WorkspacekitLift = true
		return nil
	}
}

// Instrument builds and uploads an agent to a pod, then connects to its RPC service.
// We first check if there's an executable in the path named `gitpod-integration-test-<agentName>-agent`.
// If there isn't, we attempt to build `<agentName>_agent/main.go`.
// The binary is copied to the destination pod, started and port-forwarded. Then we
// create an RPC client.
// Test.Done() will stop the agent and port-forwarding.
func (it *Test) Instrument(component ComponentType, agentName string, opts ...InstrumentOption) (agent *rpc.Client, err error) {
	options := instrumentOptions{
		WorkspacekitLift: true,
	}
	for _, o := range opts {
		err := o(&options)
		if err != nil {
			return nil, err
		}
	}

	expectedBinaryName := fmt.Sprintf("gitpod-integration-test-%s-agent", agentName)
	agentLoc, _ := exec.LookPath(expectedBinaryName)
	if agentLoc == "" {
		agentLoc, err = it.buildAgent(agentName)
		if err != nil {
			return nil, err
		}
		defer os.Remove(agentLoc)

		it.t.Log("agent compiled at", agentLoc)
	}

	podName, containerName, err := it.selectPod(component, options.SPO)
	if err != nil {
		return nil, err
	}
	tgtFN := filepath.Base(agentLoc)
	err = it.uploadAgent(agentLoc, tgtFN, podName, containerName)
	if err != nil {
		return nil, err
	}

	localAgentPort, err := getFreePort()
	if err != nil {
		return nil, err
	}

	cmd := []string{filepath.Join("/tmp", tgtFN), "-rpc-port", strconv.Itoa(localAgentPort)}
	if options.WorkspacekitLift {
		cmd = append([]string{"/.supervisor/workspacekit", "lift"}, cmd...)
	}

	execErrs := make(chan error, 1)
	go func() {
		defer close(execErrs)
		execErr := it.executeAgent(cmd, podName, containerName)
		if err != nil {
			execErrs <- execErr
		}
	}()
	select {
	case err = <-execErrs:
		if err != nil {
			return nil, err
		}
		return nil, xerrors.Errorf("agent stopped unexepectedly")
	case <-time.After(1 * time.Second):
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer func() {
		if err == nil {
			it.closer = append(it.closer, func() error {
				cancel()
				return nil
			})
		} else {
			cancel()
		}
	}()
	fwdReady, fwdErr := forwardPort(ctx, it.restConfig, it.namespace, podName, strconv.Itoa(localAgentPort))
	select {
	case <-fwdReady:
	case err = <-execErrs:
		if err != nil {
			return nil, err
		}
	case err := <-fwdErr:
		if err != nil {
			return nil, err
		}
	}

	var res *rpc.Client
	for i := 0; i < 10; i++ {
		res, err = rpc.DialHTTP("tcp", fmt.Sprintf("localhost:%d", localAgentPort))
		if err != nil && strings.Contains(err.Error(), "unexpected EOF") {
			time.Sleep(1 * time.Second)
			continue
		}

		break
	}
	if err != nil {
		return nil, err
	}

	it.closer = append(it.closer, func() error {
		err := res.Call(MethodTestAgentShutdown, new(TestAgentShutdownRequest), new(TestAgentShutdownResponse))
		if err != nil && strings.Contains(err.Error(), "connection is shut down") {
			return nil
		}
		if err != nil {
			return xerrors.Errorf("cannot shutdown agent: %w", err)
		}
		return nil
	})

	return res, nil
}

func (it *Test) Child(t *testing.T) *Test {
	ctx, cancel := context.WithCancel(it.ctx)
	res := &Test{
		t:          t,
		clientset:  it.clientset,
		restConfig: it.restConfig,
		namespace:  it.namespace,
		ctx:        ctx,
		ctxCancel:  cancel,
		api:        it.api,
		username:   it.username,
	}
	it.closer = append(it.closer, func() error { res.Done(); return nil })
	return res
}

func getFreePort() (int, error) {
	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

// ForwardPort establishes a TCP port forwarding to a Kubernetes pod
func forwardPort(ctx context.Context, config *rest.Config, namespace, pod, port string) (readychan chan struct{}, errchan chan error) {
	errchan = make(chan error, 1)
	readychan = make(chan struct{}, 1)

	roundTripper, upgrader, err := spdy.RoundTripperFor(config)
	if err != nil {
		errchan <- err
		return
	}

	path := fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/portforward", namespace, pod)
	hostIP := strings.TrimPrefix(config.Host, "https://")
	serverURL := url.URL{Scheme: "https", Path: path, Host: hostIP}
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: roundTripper}, http.MethodPost, &serverURL)

	stopChan := make(chan struct{}, 1)
	fwdReadyChan := make(chan struct{}, 1)
	out, errOut := new(bytes.Buffer), new(bytes.Buffer)
	forwarder, err := portforward.New(dialer, []string{port}, stopChan, fwdReadyChan, out, errOut)
	if err != nil {
		panic(err)
	}

	var once sync.Once
	go func() {
		err := forwarder.ForwardPorts()
		if err != nil {
			errchan <- err
		}
		once.Do(func() { close(readychan) })
	}()

	go func() {
		select {
		case <-readychan:
			// we're out of here
		case <-ctx.Done():
			close(stopChan)
		}
	}()

	go func() {
		for range fwdReadyChan {
		}

		if errOut.Len() != 0 {
			errchan <- xerrors.Errorf(errOut.String())
			return
		}

		once.Do(func() { close(readychan) })
	}()

	return
}

func (it *Test) executeAgent(cmd []string, pod, container string) (err error) {
	restClient := it.clientset.CoreV1().RESTClient()
	req := restClient.Post().
		Resource("pods").
		Name(pod).
		Namespace(it.namespace).
		SubResource("exec").
		Param("container", container)
	req.VersionedParams(&corev1.PodExecOptions{
		Container: container,
		Command:   cmd,
		Stdin:     false,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(it.restConfig, "POST", req.URL())
	if err != nil {
		return err
	}

	return exec.Stream(remotecommand.StreamOptions{
		Stdout: os.Stdout,
		Stderr: os.Stderr,
		Tty:    true,
	})
}

func (it *Test) uploadAgent(srcFN, tgtFN string, pod, container string) (err error) {
	stat, err := os.Stat(srcFN)
	if err != nil {
		return xerrors.Errorf("cannot upload agent: %w", err)
	}
	srcIn, err := os.Open(srcFN)
	if err != nil {
		return xerrors.Errorf("cannot upload agent: %w", err)
	}
	defer srcIn.Close()

	tarIn, tarOut := io.Pipe()

	restClient := it.clientset.CoreV1().RESTClient()
	req := restClient.Post().
		Resource("pods").
		Name(pod).
		Namespace(it.namespace).
		SubResource("exec").
		Param("container", container)
	req.VersionedParams(&corev1.PodExecOptions{
		Container: container,
		Command:   []string{"tar", "-xmf", "-", "-C", "/tmp"},
		Stdin:     true,
		Stdout:    false,
		Stderr:    false,
		TTY:       false,
	}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(it.restConfig, "POST", req.URL())
	if err != nil {
		return xerrors.Errorf("cannot upload agent: %w", err)
	}

	var eg errgroup.Group
	eg.Go(func() error {
		err := exec.Stream(remotecommand.StreamOptions{
			Stdin: tarIn,
			Tty:   false,
		})
		if err != nil {
			return xerrors.Errorf("cannot upload agent: %w", err)
		}
		return nil
	})
	eg.Go(func() error {
		tarw := tar.NewWriter(tarOut)
		err = tarw.WriteHeader(&tar.Header{
			Typeflag: tar.TypeReg,
			Name:     tgtFN,
			Size:     stat.Size(),
			Mode:     0777,
		})
		if err != nil {
			return xerrors.Errorf("cannot upload agent: %w", err)
		}

		_, err = io.Copy(tarw, srcIn)
		if err != nil {
			return xerrors.Errorf("cannot upload agent: %w", err)
		}

		tarw.Close()
		tarOut.Close()

		return nil
	})

	return eg.Wait()
}

func (t *Test) buildAgent(name string) (loc string, err error) {
	defer func() {
		if err != nil {
			err = xerrors.Errorf("cannot build agent: %w", err)
		}
	}()

	src := name + "_agent/main.go"
	if _, err := os.Stat(src); err != nil {
		return "", err
	}

	f, err := os.CreateTemp("", "gitpod-integration-test-*")
	if err != nil {
		return "", err
	}
	f.Close()

	cmd := exec.Command("go", "build", "-o", f.Name(), src)
	cmd.Env = append(os.Environ(),
		"CGO_ENABLED=0",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", xerrors.Errorf("%w: %s", err, string(out))
	}

	return f.Name(), nil
}

func (t *Test) selectPod(component ComponentType, options selectPodOptions) (pod string, container string, err error) {
	listOptions := metav1.ListOptions{
		LabelSelector: "component=" + string(component),
	}
	if component == ComponentWorkspace && options.InstanceID != "" {
		listOptions.LabelSelector = "component=workspace,workspaceID=" + options.InstanceID
	}
	if component == ComponentWorkspaceDaemon && options.InstanceID != "" {
		var pods *corev1.PodList
		pods, err = t.clientset.CoreV1().Pods(t.namespace).List(context.Background(), metav1.ListOptions{
			LabelSelector: "component=workspace,workspaceID=" + options.InstanceID,
		})
		if err != nil {
			err = xerrors.Errorf("cannot list pods: %w", err)
			return
		}
		if len(pods.Items) == 0 {
			err = xerrors.Errorf("no workspace pod for instance %s", options.InstanceID)
			return
		}
		listOptions.FieldSelector = "spec.nodeName=" + pods.Items[0].Spec.NodeName
	}

	pods, err := t.clientset.CoreV1().Pods(t.namespace).List(context.Background(), listOptions)
	if err != nil {
		err = xerrors.Errorf("cannot list pods: %w", err)
		return
	}
	if len(pods.Items) == 0 {
		err = xerrors.Errorf("no pods for %s", component)
		return
	}
	p := pods.Items[0]
	pod = p.Name
	if len(pods.Items) > 1 {
		t.t.Logf("found multiple pods for %s, choosing %s", component, pod)
	}

	if options.Container != "" {
		var found bool
		for _, container := range pods.Items[0].Spec.Containers {
			if container.Name == options.Container {
				found = true
				break
			}
		}

		if !found {
			err = xerrors.Errorf("no container name %s found", options.Container)
			return
		}

		container = options.Container
	}

	return
}

// ServerConfigPartial is the subset of server config we're using for integration tests.
// Ideally we're using a definition derived from the config interface, someday...
type ServerConfigPartial struct {
	HostURL           string `json:"hostUrl"`
	WorkspaceDefaults struct {
		IDEImageAliases struct {
			Code string `json:"code"`
		} `json:"ideImageAliases"`
	} `json:"workspaceDefaults"`
}

func (t *Test) GetServerConfig() (*ServerConfigPartial, error) {
	cm, err := t.clientset.CoreV1().ConfigMaps(t.namespace).Get(context.Background(), "server-config", metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	key := "config.json"
	configJson, ok := cm.Data[key]
	if !ok {
		return nil, fmt.Errorf("key %s not found", key)
	}

	var config ServerConfigPartial
	err = json.Unmarshal([]byte(configJson), &config)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling config: %v", err)
	}
	return &config, nil
}

// ComponentType denotes a Gitpod component
type ComponentType string

const (
	// ComponentWorkspaceDaemon points to the workspace daemon
	ComponentWorkspaceDaemon ComponentType = "ws-daemon"
	// ComponentWorkspaceManager points to the workspace manager
	ComponentWorkspaceManager ComponentType = "ws-manager"
	// ComponentContentService points to the content service
	ComponentContentService ComponentType = "content-service"
	// ComponentWorkspace points to a workspace
	ComponentWorkspace ComponentType = "workspace"
	// ComponentImageBuilder points to the image-builder
	ComponentImageBuilder ComponentType = "image-builder"
	// ComponentImageBuilder points to the image-builder-mk3
	ComponentImageBuilderMK3 ComponentType = "image-builder-mk3"
)
