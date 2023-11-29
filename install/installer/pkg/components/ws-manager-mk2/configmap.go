// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagermk2

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

	classes := map[string]*config.WorkspaceClass{
		config.DefaultWorkspaceClass: {
			Name: config.DefaultWorkspaceClass,
			Container: config.ContainerConfiguration{
				Requests: &config.ResourceRequestConfiguration{
					CPU:              quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceCPU),
					Memory:           quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceMemory),
					EphemeralStorage: quantityString(ctx.Config.Workspace.Resources.Requests, corev1.ResourceEphemeralStorage),
				},
				Limits: &config.ResourceLimitConfiguration{
					CPU: &config.CpuResourceLimit{
						MinLimit:   quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceCPU),
						BurstLimit: quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceCPU),
					},
					Memory:           quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceMemory),
					EphemeralStorage: quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceEphemeralStorage),
					Storage:          quantityString(ctx.Config.Workspace.Resources.Limits, corev1.ResourceStorage),
				},
			},
			Templates: templatesCfg,
		},
	}
	var preferredWorkspaceClass string

	installationShortNameSuffix := ""
	if ctx.Config.Metadata.InstallationShortname != "" && ctx.Config.Metadata.InstallationShortname != configv1.InstallationShortNameOldDefault {
		installationShortNameSuffix = "-" + ctx.Config.Metadata.InstallationShortname
	}

	var schedulerName string
	gitpodHostURL := "https://" + ctx.Config.Domain
	workspaceClusterHost := fmt.Sprintf("ws%s.%s", installationShortNameSuffix, ctx.Config.Domain)
	workspaceURLTemplate := fmt.Sprintf("https://{{ .Prefix }}.ws%s.%s", installationShortNameSuffix, ctx.Config.Domain)
	workspacePortURLTemplate := fmt.Sprintf("https://{{ .WorkspacePort }}-{{ .Prefix }}.ws%s.%s", installationShortNameSuffix, ctx.Config.Domain)
	hostWorkingArea := wsdaemon.HostWorkingAreaMk2

	rateLimits := map[string]grpc.RateLimit{}

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
				Name: c.Name,
				Container: config.ContainerConfiguration{
					Requests: &config.ResourceRequestConfiguration{
						CPU:              quantityString(c.Resources.Requests, corev1.ResourceCPU),
						Memory:           quantityString(c.Resources.Requests, corev1.ResourceMemory),
						EphemeralStorage: quantityString(c.Resources.Requests, corev1.ResourceEphemeralStorage),
					},
					Limits: &config.ResourceLimitConfiguration{
						CPU: &config.CpuResourceLimit{
							MinLimit:   c.Resources.Limits.Cpu.MinLimit,
							BurstLimit: c.Resources.Limits.Cpu.BurstLimit,
						},
						Memory:           c.Resources.Limits.Memory,
						EphemeralStorage: c.Resources.Limits.EphemeralStorage,
						Storage:          c.Resources.Limits.Storage,
					},
				},
				Templates: tplsCfg,
			}
			for tmpl_n, tmpl_v := range ctpls {
				if _, ok := tpls[tmpl_n]; ok {
					return fmt.Errorf("duplicate workspace template %q in workspace class %q", tmpl_n, k)
				}
				tpls[tmpl_n] = tmpl_v
			}
		}
		preferredWorkspaceClass = ucfg.Workspace.PreferredWorkspaceClass
		if preferredWorkspaceClass == "" {
			// if no preferred workspace class is set, use a random one (maps have no order, there is no "first")
			for _, k := range ucfg.Workspace.WorkspaceClasses {
				preferredWorkspaceClass = k.Name
				break
			}
		}

		schedulerName = ucfg.Workspace.SchedulerName
		if ucfg.Workspace.HostURL != "" {
			gitpodHostURL = ucfg.Workspace.HostURL
		}
		if ucfg.Workspace.WorkspaceClusterHost != "" {
			workspaceClusterHost = ucfg.Workspace.WorkspaceClusterHost
		}
		if ucfg.Workspace.WorkspaceURLTemplate != "" {
			workspaceURLTemplate = ucfg.Workspace.WorkspaceURLTemplate
		}
		if ucfg.Workspace.WorkspacePortURLTemplate != "" {
			workspacePortURLTemplate = ucfg.Workspace.WorkspacePortURLTemplate
		}
		rateLimits = ucfg.Workspace.WSManagerRateLimits

		return nil
	})
	if err != nil {
		return nil, err
	}

	var imageBuilderTLS struct {
		CA          string `json:"ca"`
		Certificate string `json:"crt"`
		PrivateKey  string `json:"key"`
	}
	if ctx.Config.Kind == configv1.InstallationWorkspace {
		// Image builder TLS is only enabled in workspace clusters. This check
		// can be removed once image-builder-mk3 has been removed from application clusters
		// (https://github.com/gitpod-io/gitpod/issues/7845).
		imageBuilderTLS = struct {
			CA          string `json:"ca"`
			Certificate string `json:"crt"`
			PrivateKey  string `json:"key"`
		}{
			CA:          "/image-builder-mk3-tls-certs/ca.crt",
			Certificate: "/image-builder-mk3-tls-certs/tls.crt",
			PrivateKey:  "/image-builder-mk3-tls-certs/tls.key",
		}
	}

	wsmcfg := config.ServiceConfiguration{
		Manager: config.Configuration{
			Namespace:        ctx.Namespace,
			SecretsNamespace: common.WorkspaceSecretsNamespace,
			SchedulerName:    schedulerName,
			SeccompProfile:   fmt.Sprintf("workspace_default_%s.json", ctx.VersionManifest.Version),
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
			WorkspaceClasses:        classes,
			PreferredWorkspaceClass: preferredWorkspaceClass,
			HeartbeatInterval:       util.Duration(30 * time.Second),
			GitpodHostURL:           gitpodHostURL,
			WorkspaceClusterHost:    workspaceClusterHost,
			InitProbe: config.InitProbeConfiguration{
				Timeout: (1 * time.Second).String(),
			},
			WorkspaceURLTemplate:     workspaceURLTemplate,
			WorkspacePortURLTemplate: workspacePortURLTemplate,
			WorkspaceHostPath:        hostWorkingArea,
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
			ReconnectionInterval:             util.Duration(30 * time.Second),
			RegistryFacadeHost:               fmt.Sprintf("reg.%s:%d", ctx.Config.Domain, common.RegistryFacadeServicePort),
			WorkspaceMaxConcurrentReconciles: 25,
			TimeoutMaxConcurrentReconciles:   15,
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
			RateLimits: rateLimits,
		},
		ImageBuilderProxy: struct {
			TargetAddr string "json:\"targetAddr\""
			TLS        struct {
				CA          string `json:"ca"`
				Certificate string `json:"crt"`
				PrivateKey  string `json:"key"`
			} `json:"tls"`
		}{
			TargetAddr: fmt.Sprintf("%s.%s.svc.cluster.local:%d", common.ImageBuilderComponent, ctx.Namespace, common.ImageBuilderRPCPort),
			TLS:        imageBuilderTLS,
		},
		PProf: struct {
			Addr string `json:"addr"`
		}{Addr: common.LocalhostPprofAddr()},
		Prometheus: struct {
			Addr string `json:"addr"`
		}{Addr: common.LocalhostPrometheusAddr()},
		Health: struct {
			Addr string `json:"addr"`
		}{Addr: fmt.Sprintf(":%d", HealthPort)},
	}

	if ctx.Config.CustomCACert != nil {
		wsmcfg.Manager.EnableCustomSSLCertificate = true
	}

	if ctx.Config.SSHGatewayCAKey == nil {
		wsmcfg.Manager.SSHGatewayCAPublicKeyFile = "/mnt/ca-key/ca.pem"
	}

	fc, err := common.ToJSONString(wsmcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-manager config: %w", err)
	}

	res := []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        Component,
				Namespace:   ctx.Namespace,
				Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      WorkspaceTemplateConfigMap,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: tpls,
		},
	}
	return res, nil
}

func buildWorkspaceTemplates(ctx *common.RenderContext, cfgTpls *configv1.WorkspaceTemplates, className string) (config.WorkspacePodTemplateConfiguration, map[string]string, error) {
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
		fn := op.Name + ".yaml"
		if className != "" {
			fn = className + "-" + fn
		}
		*op.Path = filepath.Join(WorkspaceTemplatePath, fn)
		tpls[fn] = string(fc)
	}

	return cfg, tpls, nil
}
