// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"time"

	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	"k8s.io/utils/pointer"
	"sigs.k8s.io/yaml"

	"github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/util"
	storageconfig "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	templatesCfg, tpls, err := buildWorkspaceTemplates(ctx)
	if err != nil {
		return nil, err
	}

	quantityString := func(idx corev1.ResourceList, key corev1.ResourceName) string {
		q, ok := idx[key]
		if !ok {
			return ""
		}
		return (&q).String()
	}

	wsmcfg := config.ServiceConfiguration{
		Manager: config.Configuration{
			Namespace:      ctx.Namespace,
			SchedulerName:  "workspace-scheduler",
			SeccompProfile: fmt.Sprintf("localhost/workspace_default_%s.json", ctx.VersionManifest.Version),
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
						CPU:              quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceCPU),
						Memory:           quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceMemory),
						EphemeralStorage: quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceEphemeralStorage),
					},
					Limits: config.ResourceConfiguration{
						CPU:              quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceCPU),
						Memory:           quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceMemory),
						EphemeralStorage: quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceEphemeralStorage),
					},
					Image: "OVERWRITTEN-IN-REQUEST",
				},
			},
			HeartbeatInterval:    util.Duration(30 * time.Second),
			GitpodHostURL:        "https://" + ctx.Config.Domain,
			WorkspaceClusterHost: fmt.Sprintf("ws.%s", ctx.Config.Domain),
			InitProbe: config.InitProbeConfiguration{
				Timeout: (1 * time.Second).String(),
			},
			WorkspaceURLTemplate:     fmt.Sprintf("https://{{ .Prefix }}.ws.%s", ctx.Config.Domain),
			WorkspacePortURLTemplate: fmt.Sprintf("https://{{ .WorkspacePort }}-{{ .Prefix }}.ws.%s", ctx.Config.Domain),
			WorkspaceHostPath:        wsdaemon.HostWorkingArea,
			WorkspacePodTemplate:     templatesCfg,
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
			//EventTraceLog:                "", // todo(sje): make conditional based on config
			ReconnectionInterval:         util.Duration(30 * time.Second),
			RegistryFacadeHost:           fmt.Sprintf("reg.%s:%d", ctx.Config.Domain, common.RegistryFacadeServicePort),
			EnforceWorkspaceNodeAffinity: true,
		},
		Content: struct {
			Storage storageconfig.StorageConfig `json:"storage"`
		}{Storage: common.StorageConfig(ctx)},
		RPCServer: struct {
			Addr string `json:"addr"`
			TLS  struct {
				CA          string `json:"ca"`
				Certificate string `json:"crt"`
				PrivateKey  string `json:"key"`
			} `json:"tls"`
			RateLimits map[string]grpc.RateLimit `json:"ratelimits"`
		}{
			Addr: fmt.Sprintf(":%d", RPCPort),
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

	res := []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}
	res = append(res, tpls...)
	return res, nil
}

func buildWorkspaceTemplates(ctx *common.RenderContext) (config.WorkspacePodTemplateConfiguration, []runtime.Object, error) {
	var (
		cfg  config.WorkspacePodTemplateConfiguration
		tpls = make(map[string]string)
	)
	cfgTpls := ctx.Config.Workspace.Templates
	if cfgTpls == nil {
		cfgTpls = &configv1.WorkspaceTemplates{}
	}

	cfgTpls.Default = &corev1.Pod{
		Spec: corev1.PodSpec{
			EnableServiceLinks: pointer.Bool(false),
			DNSConfig: &corev1.PodDNSConfig{
				Nameservers: []string{
					"1.1.1.1",
					"8.8.8.8",
				},
			},
			DNSPolicy: corev1.DNSNone,
		},
	}

	ops := []struct {
		Name string
		Path *string
		Tpl  *corev1.Pod
	}{
		{Name: "default", Path: &cfg.DefaultPath, Tpl: cfgTpls.Default},
		{Name: "ghost", Path: &cfg.GhostPath, Tpl: cfgTpls.Ghost},
		{Name: "imagebuild", Path: &cfg.ImagebuildPath, Tpl: cfgTpls.ImageBuild},
		{Name: "prebuild", Path: &cfg.PrebuildPath, Tpl: cfgTpls.Prebuild},
		{Name: "regular", Path: &cfg.RegularPath, Tpl: cfgTpls.Regular},
		{Name: "probe", Path: &cfg.ProbePath, Tpl: cfgTpls.Probe},
	}
	for _, op := range ops {
		if op.Tpl == nil {
			continue
		}
		fc, err := yaml.Marshal(op.Tpl)
		if err != nil {
			return cfg, nil, fmt.Errorf("unable to marshal %s workspace template: %w", op.Name, err)
		}
		fn := op.Name + ".yaml"
		*op.Path = filepath.Join(WorkspaceTemplatePath, fn)
		tpls[fn] = string(fc)
	}

	return cfg, []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      WorkspaceTemplateConfigMap,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: tpls,
		},
	}, nil
}
