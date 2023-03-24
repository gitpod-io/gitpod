// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/rpc"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	kubectlcp "k8s.io/kubectl/pkg/cmd/cp"
	kubectlexec "k8s.io/kubectl/pkg/cmd/exec"
	"sigs.k8s.io/e2e-framework/klient"

	ide "github.com/gitpod-io/gitpod/ide-service-api/config"
	"github.com/gitpod-io/gitpod/test/pkg/integration/common"
)

const (
	connectFailureMaxTries = 5
	errorDialingBackendEOF = "error dialing backend: EOF"
)

type PodExec struct {
	RestConfig *rest.Config
	*kubernetes.Clientset
}

func NewPodExec(config rest.Config, clientset *kubernetes.Clientset) *PodExec {
	config.APIPath = "/api"                                   // Make sure we target /api and not just /
	config.GroupVersion = &schema.GroupVersion{Version: "v1"} // this targets the core api groups so the url path will be /api/v1
	config.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{CodecFactory: scheme.Codecs}
	return &PodExec{
		RestConfig: &config,
		Clientset:  clientset,
	}
}

func (p *PodExec) PodCopyFile(src string, dst string, containername string) (*bytes.Buffer, *bytes.Buffer, *bytes.Buffer, error) {
	var in, out, errOut *bytes.Buffer
	var ioStreams genericclioptions.IOStreams
	for count := 0; ; count++ {
		ioStreams, in, out, errOut = genericclioptions.NewTestIOStreams()
		copyOptions := kubectlcp.NewCopyOptions(ioStreams)
		copyOptions.Clientset = p.Clientset
		copyOptions.ClientConfig = p.RestConfig
		copyOptions.Container = containername
		err := copyOptions.Run([]string{src, dst})
		if err != nil {
			if !shouldRetry(count, err) {
				return nil, nil, nil, fmt.Errorf("could not run copy operation: %v", err)
			}
			time.Sleep(10 * time.Second)
			continue
		}
		break
	}
	return in, out, errOut, nil
}

func shouldRetry(count int, err error) bool {
	if count < connectFailureMaxTries {
		return err.Error() == errorDialingBackendEOF
	}
	return false
}

func (p *PodExec) ExecCmd(command []string, podname string, namespace string, containername string) (*bytes.Buffer, *bytes.Buffer, *bytes.Buffer, error) {
	var (
		in, out, errOut *bytes.Buffer
		ioStreams       genericclioptions.IOStreams
	)
	for count := 0; ; count++ {
		ioStreams, in, out, errOut = genericclioptions.NewTestIOStreams()
		execOptions := &kubectlexec.ExecOptions{
			StreamOptions: kubectlexec.StreamOptions{
				IOStreams:     ioStreams,
				Namespace:     namespace,
				PodName:       podname,
				ContainerName: containername,
			},

			Command:   command,
			Executor:  &kubectlexec.DefaultRemoteExecutor{},
			PodClient: p.Clientset.CoreV1(),
			Config:    p.RestConfig,
		}
		err := execOptions.Run()
		if err != nil {
			if !shouldRetry(count, err) {
				return nil, nil, nil, fmt.Errorf("could not run exec operation: %v", err)
			}
			time.Sleep(30 * time.Second)
			continue
		}
		break
	}

	return in, out, errOut, nil
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
		io.WorkspacekitLift = lift
		return nil
	}
}

// The rpc is brittle because it installs the agent in the workspace and port-foward to send instructions. Therefore, wrap and retry.
type RpcClient struct {
	client     *rpc.Client
	component  ComponentType
	agentName  string
	namespace  string
	kubeconfig string
	kclient    klient.Client
	opts       []InstrumentOption
}

func (r *RpcClient) Call(serviceMethod string, args any, reply any) error {
	var err error
	var new *RpcClient
	for i := 0; i < connectFailureMaxTries; i++ {
		if r != nil {
			if err = r.client.Call(serviceMethod, args, reply); err != nil {
				time.Sleep(10 * time.Second)
				r.Close()
				new, _, err = Instrument(r.component, r.agentName, r.namespace, r.kubeconfig, r.kclient, r.opts...)
				if err != nil {
					time.Sleep(10 * time.Second)
					continue
				}
				r = new
			}
		} else {
			new, _, err = Instrument(r.component, r.agentName, r.namespace, r.kubeconfig, r.kclient, r.opts...)
			if err != nil {
				time.Sleep(10 * time.Second)
				continue
			}
			r = new
		}
	}
	return err
}

func (r *RpcClient) Close() error {
	return r.client.Close()
}

// Instrument builds and uploads an agent to a pod, then connects to its RPC service.
// We first check if there's an executable in the path named `gitpod-integration-test-<agentName>-agent`.
// If there isn't, we attempt to build `<agentName>_agent/main.go`.
// The binary is copied to the destination pod, started and port-forwarded. Then we
// create an RPC client.
func Instrument(component ComponentType, agentName string, namespace string, kubeconfig string, client klient.Client, opts ...InstrumentOption) (*RpcClient, []func() error, error) {
	var closer []func() error

	options := instrumentOptions{
		WorkspacekitLift: true,
	}
	for _, o := range opts {
		err := o(&options)
		if err != nil {
			return nil, closer, err
		}
	}

	var (
		res           *rpc.Client
		clientConfig  *kubernetes.Clientset
		cl            []func() error
		podName       string
		containerName string
		err           error
	)
	for i := 0; i < connectFailureMaxTries; i++ {
		expectedBinaryName := fmt.Sprintf("gitpod-integration-test-%d-%s-agent", i, agentName)
		agentLoc, _ := exec.LookPath(expectedBinaryName)
		if agentLoc == "" {
			var err error
			agentLoc, err = buildAgent(agentName)
			if err != nil {
				return nil, closer, err
			}
			defer os.Remove(agentLoc)
		}

		podName, containerName, err = selectPod(component, options.SPO, namespace, client)
		if err != nil {
			time.Sleep(10 * time.Second)
			continue
		}

		clientConfig, err = kubernetes.NewForConfig(client.RESTConfig())
		if err != nil {
			return nil, closer, err
		}
		podExec := NewPodExec(*client.RESTConfig(), clientConfig)

		tgtFN := filepath.Base(agentLoc)
		_, _, _, err = podExec.PodCopyFile(agentLoc, fmt.Sprintf("%s/%s:/home/gitpod/%s", namespace, podName, tgtFN), containerName)
		if err != nil {
			return nil, closer, err
		}

		res, cl, err = portfw(podExec, kubeconfig, podName, namespace, containerName, tgtFN, options)
		if err != nil {
			var serror error
			waitErr := wait.PollImmediate(10*time.Second, 2*time.Minute, func() (bool, error) {
				serror = shutdownAgent(podExec, kubeconfig, podName, namespace, containerName)
				if serror != nil {
					if strings.Contains(serror.Error(), "exit code 7") {
						serror = nil
						return true, nil
					}
					return false, nil
				}
				return true, nil
			})
			if waitErr == wait.ErrWaitTimeout {
				return nil, closer, xerrors.Errorf("timed out attempting to shutdown agent: %v", serror)
			} else if waitErr != nil {
				return nil, closer, waitErr
			}

			if serror != nil {
				return nil, closer, serror
			}
			for _, c := range cl {
				_ = c()
			}

			continue
		}
		break
	}
	if err != nil {
		for _, c := range cl {
			_ = c()
		}
		return nil, closer, err
	}

	closer = append(closer, cl...)
	closer = append(closer, func() error {
		if res != nil {
			err := res.Call(MethodTestAgentShutdown, new(TestAgentShutdownRequest), new(TestAgentShutdownResponse))
			if err != nil && strings.Contains(err.Error(), "connection is shut down") {
				return nil
			}

			if err != nil {
				return xerrors.Errorf("cannot shutdown agent: %w", err)
			}
		}
		return nil
	})

	return &RpcClient{
		client:     res,
		component:  component,
		agentName:  agentName,
		namespace:  namespace,
		kubeconfig: kubeconfig,
		kclient:    client,
		opts:       opts,
	}, closer, nil
}

func portfw(podExec *PodExec, kubeconfig string, podName string, namespace string, containerName string, tgtFN string, options instrumentOptions) (*rpc.Client, []func() error, error) {
	var closer []func() error

	localAgentPort, err := getFreePort()
	if err != nil {
		return nil, closer, err
	}

	cmd := []string{filepath.Join("/home/gitpod/", tgtFN), "-rpc-port", strconv.Itoa(localAgentPort)}
	if options.WorkspacekitLift {
		cmd = append([]string{"/.supervisor/workspacekit", "lift"}, cmd...)
	}

	execErrs := make(chan error, 1)
	go func() {
		defer close(execErrs)
		_, _, _, execErr := podExec.ExecCmd(cmd, podName, namespace, containerName)
		if execErr != nil {
			execErrs <- execErr
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer func() {
		if err == nil {
			closer = append(closer, func() error {
				cancel()
				return nil
			})
		} else {
			cancel()
		}
	}()
L:
	for {
		fwdReady, fwdErr := common.ForwardPortOfPod(ctx, kubeconfig, namespace, podName, strconv.Itoa(localAgentPort))

		select {
		case <-time.After(2 * time.Minute):
			cancel()
			return nil, closer, xerrors.New("timeout")
		case <-fwdReady:
			break L
		case err = <-execErrs:
			return nil, closer, xerrors.Errorf("failure of port-fowarding: %w", err)
		case err = <-fwdErr:
			var eno syscall.Errno
			if errors.Is(err, io.EOF) || (errors.As(err, &eno) && eno == syscall.ECONNREFUSED) {
				time.Sleep(5 * time.Second)
			} else if st, ok := status.FromError(err); ok && st.Code() == codes.Unavailable {
				time.Sleep(5 * time.Second)
			} else if err != nil {
				return nil, closer, err
			}
		}
	}

	var res *rpc.Client
	var lastError error
	waitErr := wait.PollImmediate(10*time.Second, 1*time.Minute, func() (bool, error) {
		res, lastError = rpc.DialHTTP("tcp", net.JoinHostPort("localhost", strconv.Itoa(localAgentPort)))
		if lastError != nil {
			return false, nil
		}
		return true, nil
	})
	if waitErr == wait.ErrWaitTimeout {
		cancel()
		return nil, closer, xerrors.Errorf("timed out attempting to connect agent: %v", lastError)
	} else if waitErr != nil {
		cancel()
		return nil, closer, waitErr
	}

	return res, closer, nil
}

func shutdownAgent(podExec *PodExec, kubeconfig string, podName string, namespace string, containerName string) error {
	cmd := []string{"curl", "localhost:8080/shutdown"}
	_, _, _, err := podExec.ExecCmd(cmd, podName, namespace, containerName)
	return err
}

func getFreePort() (int, error) {
	l, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()

	result, err := net.ResolveTCPAddr("tcp", l.Addr().String())
	if err != nil {
		return 0, err
	}

	return result.Port, nil
}

func buildAgent(name string) (loc string, err error) {
	defer func() {
		if err != nil {
			err = xerrors.Errorf("cannot build agent: %w", err)
		}
	}()

	_, filename, _, _ := runtime.Caller(0)
	src := path.Join(path.Dir(filename), "..", "agent", name, "main.go")
	if _, err := os.Stat(src); err != nil {
		return "", err
	}

	f, err := os.CreateTemp("", "gitpod-integration-test-*")
	if err != nil {
		return "", err
	}
	f.Close()

	cmd := exec.Command("go", "build", "-trimpath", "-ldflags", "-buildid= -w -s", "-o", f.Name(), src)
	cmd.Env = append(os.Environ(),
		"CGO_ENABLED=0",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", xerrors.Errorf("%w: %s", err, string(out))
	}

	return f.Name(), nil
}

func selectPod(component ComponentType, options selectPodOptions, namespace string, client klient.Client) (string, string, error) {
	clientSet, err := kubernetes.NewForConfig(client.RESTConfig())
	if err != nil {
		return "", "", err
	}

	listOptions := metav1.ListOptions{
		LabelSelector: "component=" + string(component),
	}

	if component == ComponentWorkspace && options.InstanceID != "" {
		listOptions.LabelSelector = "component=workspace,workspaceID=" + options.InstanceID
	}

	if component == ComponentWorkspaceDaemon && options.InstanceID != "" {
		pods, err := clientSet.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
			LabelSelector: "component=workspace,workspaceID=" + options.InstanceID,
		})
		if err != nil {
			return "", "", xerrors.Errorf("cannot list pods: %w", err)
		}

		if len(pods.Items) == 0 {
			return "", "", xerrors.Errorf("no workspace pod for instance %s", options.InstanceID)
		}

		listOptions.FieldSelector = "spec.nodeName=" + pods.Items[0].Spec.NodeName
	}

	pods, err := clientSet.CoreV1().Pods(namespace).List(context.Background(), listOptions)
	if err != nil {
		return "", "", xerrors.Errorf("cannot list pods: %w", err)
	}

	if len(pods.Items) == 0 {
		return "", "", xerrors.Errorf("no pods for %s", component)
	}

	p := pods.Items[0]
	err = waitForPodRunningReady(clientSet, p.Name, namespace, 10*time.Second)
	if err != nil {
		return "", "", xerrors.Errorf("pods for component %s is not running", component)
	}

	var container string
	if options.Container != "" {
		var found bool
		for _, container := range p.Spec.Containers {
			if container.Name == options.Container {
				found = true
				break
			}
		}

		if !found {
			return "", "", xerrors.Errorf("no container name %s found", options.Container)
		}

		container = options.Container
	}
	return p.Name, container, nil
}

// ServerConfigPartial is the subset of server config we're using for integration tests.
// Ideally we're using a definition derived from the config interface, someday...
// NOTE: keep in sync with chart/templates/server-configmap.yaml
type ServerConfigPartial struct {
	HostURL           string `json:"hostUrl"`
	WorkspaceDefaults struct {
		WorkspaceImage string `json:"workspaceImage"`
	} `json:"workspaceDefaults"`
	Session struct {
		Secret string `json:"secret"`
	} `json:"session"`
}

func GetServerConfig(namespace string, client klient.Client) (*ServerConfigPartial, error) {
	var cm corev1.ConfigMap
	err := client.Resources().Get(context.Background(), "server-config", namespace, &cm)
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
		return nil, fmt.Errorf("error unmarshalling server config: %v", err)
	}
	return &config, nil
}

func GetIDEConfig(namespace string, client klient.Client) (*ide.IDEConfig, error) {
	var cm corev1.ConfigMap
	err := client.Resources().Get(context.Background(), "ide-config", namespace, &cm)
	if err != nil {
		return nil, err
	}

	key := "config.json"
	configJson, ok := cm.Data[key]
	if !ok {
		return nil, fmt.Errorf("key %s not found", key)
	}

	var config ide.IDEConfig
	err = json.Unmarshal([]byte(configJson), &config)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling server IDE config: %v", err)
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
	// ComponentWorkspaceManagerMK2 points to the MK2 workspace manager
	ComponentWorkspaceManagerMK2 ComponentType = "ws-manager-mk2"
	// ComponentContentService points to the content service
	ComponentContentService ComponentType = "content-service"
	// ComponentWorkspace points to a workspace
	ComponentWorkspace ComponentType = "workspace"
	// ComponentImageBuilderMK3 points to the image-builder-mk3
	ComponentImageBuilderMK3 ComponentType = "image-builder-mk3"
	// ComponentImageBuilderMK3Wsman points to ws-manager-mk2's image-builder-mk3
	ComponentImageBuilderMK3Wsman ComponentType = "image-builder-mk3-wsman"
)

func waitForPodRunningReady(c kubernetes.Interface, podName string, namespace string, timeout time.Duration) error {
	return wait.PollImmediate(time.Second, timeout, isPodRunningReady(c, podName, namespace))
}

func isPodRunningReady(c kubernetes.Interface, podName string, namespace string) wait.ConditionFunc {
	return func() (bool, error) {
		pod, err := c.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
		if err != nil {
			return false, err
		}

		if pod.Status.Phase != corev1.PodRunning {
			return false, nil
		}

		return isPodReady(&pod.Status), nil
	}
}

func isPodReady(s *corev1.PodStatus) bool {
	for i := range s.Conditions {
		if s.Conditions[i].Type == corev1.PodReady {
			return s.Conditions[i].Status == corev1.ConditionTrue
		}
	}

	return false
}
