// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/layer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	wsdaemon "github.com/gitpod-io/gitpod/ws-daemon/api"
	wsdaemon_mock "github.com/gitpod-io/gitpod/ws-daemon/api/mock"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/grpcpool"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/test"
	"github.com/golang/mock/gomock"
	"github.com/golang/protobuf/ptypes"
	"github.com/google/uuid"
	"github.com/spf13/afero"
	"google.golang.org/grpc"
	"google.golang.org/grpc/test/bufconn"
	"sigs.k8s.io/yaml"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
)

var integrationFlag = flag.String("integration-test", "disabled", "configures integration tests. Valid values are disabled, local or a path to a kubeconfig file")

func init() {
	wsdaemonRetryInterval = 0
}

func forIntegrationTestGetManager(t *testing.T) *Manager {
	client, ns, err := test.GetIntegrationTestClient(*integrationFlag)
	if err != nil {
		t.Fatalf("cannot get integration test client: %q", err)
	}
	if client == nil {
		t.Skipf("integration tests disabled")
		return nil
	}

	config := Configuration{
		Namespace:                ns,
		HeartbeatInterval:        util.Duration(30 * time.Second),
		TheiaHostPath:            "/tmp",
		WorkspaceHostPath:        "/tmp",
		GitpodHostURL:            "gitpod.io",
		WorkspaceURLTemplate:     "{{ .ID }}-{{ .Prefix }}-{{ .Host }}",
		WorkspacePortURLTemplate: "{{ .Host }}:{{ .IngressPort }}",
		RegistryFacadeHost:       "registry-facade:8080",
		IngressPortAllocator: &IngressPortAllocatorConfig{
			IngressRange: IngressPortRange{
				Start: 10000,
				End:   11000,
			},
			StateResyncInterval: util.Duration(30 * time.Minute),
		},
		Container: AllContainerConfiguration{
			Workspace: ContainerConfiguration{
				Limits: ResourceConfiguration{
					CPU:    "900m",
					Memory: "1000M",
				},
				Requests: ResourceConfiguration{
					CPU:    "1m",
					Memory: "1m",
				},
			},
		},
		Timeouts: WorkspaceTimeoutConfiguration{
			AfterClose:          util.Duration(1 * time.Minute),
			Initialization:      util.Duration(30 * time.Minute),
			TotalStartup:        util.Duration(45 * time.Minute),
			RegularWorkspace:    util.Duration(60 * time.Minute),
			HeadlessWorkspace:   util.Duration(90 * time.Minute),
			Stopping:            util.Duration(60 * time.Minute),
			ContentFinalization: util.Duration(15 * time.Minute),
			Interrupted:         util.Duration(5 * time.Minute),
		},
		EventTraceLog: fmt.Sprintf("/tmp/evts-%x.json", sha256.Sum256([]byte(t.Name()))),
	}

	m, err := New(config, client, &layer.Provider{Storage: &storage.PresignedNoopStorage{}})
	if err != nil {
		t.Fatalf("cannot create manager: %s", err.Error())
	}
	// we don't have propr DNS resolution and network access - and we cannot mock it
	m.Config.InitProbe.Disabled = true
	return m
}

func NewStatusRecorder(t *testing.T) *StatusRecoder {
	res := &StatusRecoder{t: t, inc: make(chan api.WorkspaceStatus)}
	go res.run()
	return res
}

type StatusRecoder struct {
	t *testing.T

	log    []api.WorkspaceStatus
	waiter map[string]*statusWaiter
	inc    chan api.WorkspaceStatus
	mu     sync.Mutex
}

func (r *StatusRecoder) run() {
	for s := range r.inc {
		r.log = append(r.log, s)

		r.mu.Lock()
		for k, w := range r.waiter {
			if w.P(&s) {
				close(w.C)
				delete(r.waiter, k)
			}
		}
		r.mu.Unlock()
	}
}

func (r *StatusRecoder) String() string {
	res := make([]string, len(r.log))
	for i, u := range r.log {
		up, err := json.Marshal(u)
		if err != nil {
			res[i] = fmt.Sprintf("phase:%d %q", u.Phase, err)
			continue
		}
		res[i] = fmt.Sprintf("phase:%d %s", u.Phase, up)
	}
	return strings.Join(res, "\n")
}

type statusWaiter struct {
	C chan struct{}
	P StatusWaitFunc
}

type StatusWaitFunc func(*api.WorkspaceStatus) bool

func (r *StatusRecoder) Send(resp *api.SubscribeResponse) (err error) {
	status := resp.GetStatus()
	if status == nil {
		return
	}

	r.inc <- *status
	return
}

func (r *StatusRecoder) WaitFor(p StatusWaitFunc, timeout time.Duration) (ok bool) {
	r.mu.Lock()
	if r.waiter == nil {
		r.waiter = make(map[string]*statusWaiter)
	}
	w := &statusWaiter{C: make(chan struct{}), P: p}
	r.waiter[uuid.New().String()] = w
	r.mu.Unlock()

	if timeout == 0 {
		<-w.C
		return true
	}

	select {
	case <-w.C:
		return true
	case <-time.After(timeout):
		return false
	}
}

func (r *StatusRecoder) Log() []api.WorkspaceStatus {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.log
}

func ensureIntegrationTestTheiaLabelOnNodes(client kubernetes.Interface, namespace string) (version string, err error) {
	version = "wsman-test"

	nodes, err := client.CoreV1().Nodes().List(metav1.ListOptions{LabelSelector: fmt.Sprintf("gitpod.io/theia.%s", version)})
	if err != nil {
		log.WithError(err).Warnf("cannot list nodes to check if one has the gitpod.io/theia.%s label", version)
		return "wsman-test", nil
	}

	if len(nodes.Items) == 0 {
		return "", fmt.Errorf("no nodes with the gitpod.io/theia.%s label available", version)
	}

	return
}

func connectToMockWsdaemon(ctx context.Context, wsdaemonSrv wsdaemon.WorkspaceContentServiceServer) (*grpc.ClientConn, error) {
	lis := bufconn.Listen(1024 * 1024)
	srv := grpc.NewServer()
	wsdaemon.RegisterWorkspaceContentServiceServer(srv, wsdaemonSrv)
	go func() {
		err := srv.Serve(lis)
		if err != nil {
			panic(fmt.Sprintf("grpc failure: %q", err))
		}
	}()

	conn, err := grpc.DialContext(ctx, "bufnet", grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return lis.Dial() }), grpc.WithInsecure())
	if err != nil {
		return nil, err
	}
	return conn, nil
}

type IntegrationTestPodTemplates struct {
	Default  *corev1.Pod
	Prebuild *corev1.Pod
	Probe    *corev1.Pod
	Regular  *corev1.Pod
}

type SingleWorkspaceIntegrationTest struct {
	MockWsdaemon              func(t *testing.T, s *wsdaemon_mock.MockWorkspaceContentServiceServer)
	WsdaemonConnectionContext func() context.Context
	StartRequestModifier      func(t *testing.T, req *api.StartWorkspaceRequest)
	PostStart                 func(t *testing.T, monitor *Monitor, instanceID string, updates *StatusRecoder)
	PodTemplates              IntegrationTestPodTemplates
}

func (test *SingleWorkspaceIntegrationTest) FillDefaults() *SingleWorkspaceIntegrationTest {
	if test.MockWsdaemon == nil {
		test.MockWsdaemon = func(t *testing.T, s *wsdaemon_mock.MockWorkspaceContentServiceServer) {}
	}
	if test.WsdaemonConnectionContext == nil {
		test.WsdaemonConnectionContext = context.Background
	}
	if test.StartRequestModifier == nil {
		test.StartRequestModifier = func(t *testing.T, req *api.StartWorkspaceRequest) {}
	}
	if test.PostStart == nil {
		test.PostStart = func(t *testing.T, monitor *Monitor, instanceID string, updates *StatusRecoder) {}
	}
	return test
}

func (test *SingleWorkspaceIntegrationTest) Run(t *testing.T) {
	manager := forIntegrationTestGetManager(t)
	defer manager.Close()

	fs = afero.NewMemMapFs()
	files := []struct {
		tplfn  string
		ctnt   interface{}
		setter func(fn string)
	}{
		{"default-template.yaml", test.PodTemplates.Default, func(fn string) { manager.Config.WorkspacePodTemplate.DefaultPath = fn }},
		{"prebuild-template.yaml", test.PodTemplates.Prebuild, func(fn string) { manager.Config.WorkspacePodTemplate.PrebuildPath = fn }},
		{"probe-template.yaml", test.PodTemplates.Probe, func(fn string) { manager.Config.WorkspacePodTemplate.ProbePath = fn }},
		{"regular-template.yaml", test.PodTemplates.Regular, func(fn string) { manager.Config.WorkspacePodTemplate.RegularPath = fn }},
	}
	for _, f := range files {
		if f.ctnt == nil {
			continue
		}

		b, err := yaml.Marshal(f.ctnt)
		if err != nil {
			t.Fatalf("cannot re-marshal %s template: %q", f.tplfn, err)
		}
		err = afero.WriteFile(fs, f.tplfn, b, 0755)
		if err != nil {
			t.Fatalf("cannot write %s template: %q", f.tplfn, err)
		}
		f.setter(f.tplfn)
	}

	deployedVersion, err := ensureIntegrationTestTheiaLabelOnNodes(manager.Clientset, manager.Config.Namespace)
	if err != nil {
		t.Fatal(err)
	}

	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	manager.wsdaemonPool = grpcpool.New(func(host string) (*grpc.ClientConn, error) {
		s := wsdaemon_mock.NewMockWorkspaceContentServiceServer(ctrl)
		test.MockWsdaemon(t, s)
		ctx := test.WsdaemonConnectionContext()
		return connectToMockWsdaemon(ctx, s)
	})

	monitor, err := manager.CreateMonitor()
	if err != nil {
		t.Fatalf("cannot create monitor: %q", err)
	}
	monitor.OnError = func(err error) {
		t.Errorf("monitor error: %+q", err)
	}
	err = monitor.Start()
	if err != nil {
		t.Fatalf("cannot start monitor: %q", err)
	}
	defer monitor.Stop()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	updates := NewStatusRecorder(t)
	go func() {
		err := monitor.manager.subscribe(ctx, updates)
		if err != nil && err != context.Canceled {
			// different Go routine context - cannot use t here
			panic(fmt.Sprintf("subscription failed: %q", err))
		}
	}()

	var (
		instanceID    = uuid.New().String()
		workspaceID   = uuid.New().String()
		servicePrefix = uuid.New().String()
	)
	startreq := &api.StartWorkspaceRequest{
		Id: instanceID,
		Metadata: &api.WorkspaceMetadata{
			MetaId:    workspaceID,
			Owner:     "integration-test",
			StartedAt: ptypes.TimestampNow(),
		},
		ServicePrefix: servicePrefix,
		Type:          api.WorkspaceType_REGULAR,
		Spec: &api.StartWorkspaceSpec{
			CheckoutLocation: "/workspace",
			Git: &api.GitSpec{
				Email:    "none@none.com",
				Username: "integration-test",
			},
			WorkspaceImage:    "gitpod/workspace-full:latest",
			IdeImage:          "gitpod/theia:" + deployedVersion,
			WorkspaceLocation: "/workspace",
			Initializer: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Empty{Empty: &csapi.EmptyInitializer{}},
			},
		},
	}
	test.StartRequestModifier(t, startreq)
	_, err = manager.StartWorkspace(ctx, startreq)
	if err != nil {
		t.Errorf("cannot start test workspace: %q", err)
	}
	defer manager.Clientset.CoreV1().Pods(manager.Config.Namespace).Delete(fmt.Sprintf("ws-%s", instanceID), metav1.NewDeleteOptions(30))

	test.PostStart(t, monitor, instanceID, updates)
}
