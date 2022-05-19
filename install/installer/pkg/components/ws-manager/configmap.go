// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"fmt"
	"path/filepath"
	"time"

	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	"sigs.k8s.io/yaml"

	"github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/util"
	storageconfig "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfgTpls := ctx.Config.Workspace.Templates
	if cfgTpls == nil {
		cfgTpls = &configv1.WorkspaceTemplates{}
	}
	templatesCfg, tpls, err := buildWorkspaceTemplates(ctx, cfgTpls, "")
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

	timeoutAfterClose := util.Duration(2 * time.Minute)
	if ctx.Config.Workspace.TimeoutAfterClose != nil {
		timeoutAfterClose = *ctx.Config.Workspace.TimeoutAfterClose
	}

	var customCASecret string
	if ctx.Config.CustomCACert != nil {
		customCASecret = ctx.Config.CustomCACert.Name
	}

	classes := map[string]*config.WorkspaceClass{
		config.DefaultWorkspaceClass: {
			Container: config.ContainerConfiguration{
				Requests: &config.ResourceConfiguration{
					CPU:              quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceCPU),
					Memory:           quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceMemory),
					EphemeralStorage: quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceEphemeralStorage),
				},
				Limits: &config.ResourceConfiguration{
					CPU:              quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceCPU),
					Memory:           quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceMemory),
					EphemeralStorage: quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceEphemeralStorage),
				},
			},
			Templates: templatesCfg,
			PVC: config.PVCConfiguration{
				Size:          ctx.Config.Workspace.PVC.Size,
				StorageClass:  ctx.Config.Workspace.PVC.StorageClass,
				SnapshotClass: ctx.Config.Workspace.PVC.SnapshotClass,
			},
		},
	}
	err = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.Workspace == nil {
			return nil
		}
		for k, c := range ucfg.Workspace.WorkspaceClasses {
			tplsCfg, ctpls, err := buildWorkspaceTemplates(ctx, &configv1.WorkspaceTemplates{
				Default:    c.Templates.Default,
				Prebuild:   c.Templates.Prebuild,
				ImageBuild: c.Templates.ImageBuild,
				Regular:    c.Templates.Regular,
			}, k)
			if err != nil {
				return err
			}
			classes[k] = &config.WorkspaceClass{
				Container: config.ContainerConfiguration{
					Requests: &config.ResourceConfiguration{
						CPU:              quantityString(c.Resources.Requests, corev1.ResourceCPU),
						Memory:           quantityString(c.Resources.Requests, corev1.ResourceMemory),
						EphemeralStorage: quantityString(c.Resources.Requests, corev1.ResourceEphemeralStorage),
					},
					Limits: &config.ResourceConfiguration{
						CPU:              quantityString(c.Resources.Limits, corev1.ResourceCPU),
						Memory:           quantityString(c.Resources.Limits, corev1.ResourceMemory),
						EphemeralStorage: quantityString(c.Resources.Limits, corev1.ResourceEphemeralStorage),
					},
				},
				Templates: tplsCfg,
				PVC:       config.PVCConfiguration(c.PVC),
			}
			tpls = append(tpls, ctpls...)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	installationShortNameSuffix := ""
	if ctx.Config.Metadata.InstallationShortname != "" {
		installationShortNameSuffix = "-" + ctx.Config.Metadata.InstallationShortname
	}

	wsmcfg := config.ServiceConfiguration{
		Manager: config.Configuration{
			Namespace:      ctx.Namespace,
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
			WorkspaceClasses:     classes,
			HeartbeatInterval:    util.Duration(30 * time.Second),
			GitpodHostURL:        "https://" + ctx.Config.Domain,
			WorkspaceClusterHost: fmt.Sprintf("ws.%s", ctx.Config.Domain),
			InitProbe: config.InitProbeConfiguration{
				Timeout: (1 * time.Second).String(),
			},
			WorkspaceURLTemplate:     fmt.Sprintf("https://{{ .Prefix }}.ws%s.%s", installationShortNameSuffix, ctx.Config.Domain),
			WorkspacePortURLTemplate: fmt.Sprintf("https://{{ .WorkspacePort }}-{{ .Prefix }}.ws%s.%s", installationShortNameSuffix, ctx.Config.Domain),
			WorkspaceHostPath:        wsdaemon.HostWorkingArea,
			Timeouts: config.WorkspaceTimeoutConfiguration{
				AfterClose:          timeoutAfterClose,
				HeadlessWorkspace:   util.Duration(1 * time.Hour),
				Initialization:      util.Duration(30 * time.Minute),
				RegularWorkspace:    util.Duration(30 * time.Minute),
				MaxLifetime:         ctx.Config.Workspace.MaxLifetime,
				TotalStartup:        util.Duration(1 * time.Hour),
				ContentFinalization: util.Duration(1 * time.Hour),
				Stopping:            util.Duration(1 * time.Hour),
				Interrupted:         util.Duration(5 * time.Minute),
			},
			//EventTraceLog:                "", // todo(sje): make conditional based on config
			ReconnectionInterval:  util.Duration(30 * time.Second),
			RegistryFacadeHost:    fmt.Sprintf("reg.%s:%d", ctx.Config.Domain, common.RegistryFacadeServicePort),
			WorkspaceCACertSecret: customCASecret,
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
		ImageBuilderProxy: struct {
			TargetAddr string "json:\"targetAddr\""
		}{
			TargetAddr: fmt.Sprintf("%s.%s.svc.cluster.local:%d", common.ImageBuilderComponent, ctx.Namespace, common.ImageBuilderRPCPort),
		},
		PProf: struct {
			Addr string `json:"addr"`
		}{Addr: "localhost:6060"},
		Prometheus: struct {
			Addr string `json:"addr"`
		}{Addr: "127.0.0.1:9500"},
	}

	fc, err := common.ToJSONString(wsmcfg)
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

func buildWorkspaceTemplates(ctx *common.RenderContext, cfgTpls *configv1.WorkspaceTemplates, className string) (config.WorkspacePodTemplateConfiguration, []runtime.Object, error) {
	var (
		cfg  config.WorkspacePodTemplateConfiguration
		tpls = make(map[string]string)
	)
	if cfgTpls == nil {
		cfgTpls = new(configv1.WorkspaceTemplates)
	}

	ops := []struct {
		Name string
		Path *string
		Tpl  *corev1.Pod
	}{
		{Name: "default", Path: &cfg.DefaultPath, Tpl: cfgTpls.Default},
		{Name: "imagebuild", Path: &cfg.ImagebuildPath, Tpl: cfgTpls.ImageBuild},
		{Name: "prebuild", Path: &cfg.PrebuildPath, Tpl: cfgTpls.Prebuild},
		{Name: "regular", Path: &cfg.RegularPath, Tpl: cfgTpls.Regular},
	}
	for _, op := range ops {
		if op.Tpl == nil {
			continue
		}
		fc, err := yaml.Marshal(op.Tpl)
		if err != nil {
			return cfg, nil, fmt.Errorf("unable to marshal %s workspace template: %w", op.Name, err)
		}
		fn := filepath.Join(className, op.Name+".yaml")
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
