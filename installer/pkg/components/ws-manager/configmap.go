package wsmanager

import (
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"time"
)

// @todo(sje) use type in gitpod/components/ws-manager/cmd/root.go
type managerConfigMap struct {
	Manager config.Configuration `json:"manager"`
	Content struct {
		Storage storage.Config `json:"storage"`
	} `json:"content"`
	RPCServer struct {
		Addr string `json:"addr"`
		TLS  struct {
			CA          string `json:"ca"`
			Certificate string `json:"crt"`
			PrivateKey  string `json:"key"`
		} `json:"tls"`
		RateLimits map[string]grpc.RateLimit `json:"ratelimits"`
	} `json:"rpcServer"`
	PProf struct {
		Addr string `json:"addr"`
	} `json:"pprof"`
	Prometheus struct {
		Addr string `json:"addr"`
	} `json:"prometheus"`
}

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	wsmcfg := managerConfigMap{
		// @todo(sje) put in config values
		Manager: config.Configuration{
			Namespace:      ctx.Namespace,
			SchedulerName:  "workspace-scheduler",
			SeccompProfile: "",
			DryRun:         false,
			WorkspaceDaemon: config.WorkspaceDaemonConfiguration{
				Port: 8080,
				TLS: struct {
					Authority   string `json:"ca"`
					Certificate string `json:"crt"`
					PrivateKey  string `json:"key"`
				}{
					Authority:   "/ws-daemon-tls-certs/ca.crt",
					Certificate: "/ws-daemon-tls-certs/tls.crt",
					PrivateKey:  "/ws-daemon-tls-certs/tls.key",
				},
			},
			Container: config.AllContainerConfiguration{
				Workspace: config.ContainerConfiguration{
					Requests: config.ResourceConfiguration{
						CPU:    "",
						Memory: "",
					},
					Limits: config.ResourceConfiguration{},
					Image:  "OVERWRITTEN-IN-REQUEST",
				},
			},
			HeartbeatInterval:    util.Duration(30 * time.Second),
			GitpodHostURL:        "https://",
			WorkspaceClusterHost: "",
			InitProbe: config.InitProbeConfiguration{
				Timeout: (1 * time.Second).String(),
			},
			WorkspaceURLTemplate:     "",
			WorkspacePortURLTemplate: "",
			WorkspaceHostPath:        "",
			WorkspacePodTemplate: config.WorkspacePodTemplateConfiguration{
				PrebuildPath: "",
				ProbePath:    "",
				GhostPath:    "",
				RegularPath:  "",
				DefaultPath:  "/workspace-template/default.yaml",
			},
			Timeouts: config.WorkspaceTimeoutConfiguration{
				AfterClose:          util.Duration(2 * time.Minute),
				HeadlessWorkspace:   util.Duration(1 * time.Hour),
				Initialization:      util.Duration(30 * time.Minute),
				RegularWorkspace:    util.Duration(30 * time.Minute),
				TotalStartup:        util.Duration(1 * time.Hour),
				ContentFinalization: util.Duration(1 * time.Hour),
				Stopping:            util.Duration(1 * time.Hour),
				Interrupted:         util.Duration(5 * time.Minute),
			},
			EventTraceLog:        "", // @todo(sje) make conditional based on config
			ReconnectionInterval: util.Duration(30 * time.Second),
			RegistryFacadeHost:   "",
		},
		Content: struct {
			Storage storage.Config `json:"storage"`
		}{Storage: storage.Config{}},
		RPCServer: struct {
			Addr string `json:"addr"`
			TLS  struct {
				CA          string `json:"ca"`
				Certificate string `json:"crt"`
				PrivateKey  string `json:"key"`
			} `json:"tls"`
			RateLimits map[string]grpc.RateLimit `json:"ratelimits"`
		}{
			Addr: "8080",
			TLS: struct {
				CA          string `json:"ca"`
				Certificate string `json:"crt"`
				PrivateKey  string `json:"key"`
			}{
				CA:          "/certs/ca.crt",
				Certificate: "/certs/tls.crt",
				PrivateKey:  "/certs/tls.key",
			},
			RateLimits: map[string]grpc.RateLimit{}, // todo(sje) add values
		},
		PProf: struct {
			Addr string `json:"addr"`
		}{Addr: "localhost:6060"},
		Prometheus: struct {
			Addr string `json:"addr"`
		}{Addr: "127.0.0.1:9500"},
	}

	fc, err := json.MarshalIndent(wsmcfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-manager config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaNetworkPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(component),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
