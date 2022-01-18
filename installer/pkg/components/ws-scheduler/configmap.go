// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsscheduler

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ide"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	"github.com/gitpod-io/gitpod/ws-scheduler/pkg/scaler"
	"github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// todo(sje): export this from components/ee/ws-scheduler/root
type config struct {
	Scheduler scheduler.Configuration `json:"scheduler"`
	Scaler    struct {
		Enabled    bool                                        `json:"enabled"`
		Driver     scaler.WorkspaceManagerPrescaleDriverConfig `json:"driver"`
		Controller scaler.ControllerConfig                     `json:"controller"`
	} `json:"scaler"`
	Prometheus struct {
		Addr string `json:"addr"`
	} `json:"prometheus"`
	PProf struct {
		Addr string `json:"addr"`
	} `json:"pprof"`
}

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	// todo(sje): check this config

	scaler := struct {
		Enabled    bool                                        `json:"enabled"`
		Driver     scaler.WorkspaceManagerPrescaleDriverConfig `json:"driver"`
		Controller scaler.ControllerConfig                     `json:"controller"`
	}{
		Enabled: true,
		Controller: scaler.ControllerConfig{
			Kind: "switchedConstant",
			Constant: struct {
				Setpoint int `json:"setpoint"`
			}{
				Setpoint: 5,
			},
			SwitchedConstant: struct {
				DefaultSetpoint int                       `json:"default"`
				Setpoints       []scaler.SwitchedSetpoint `json:"setpoints"`
			}{
				DefaultSetpoint: 0,
				Setpoints: []scaler.SwitchedSetpoint{
					{
						Setpoint: 80,
						Time:     scaler.TimeOfDay(time.Date(0, 1, 1, 6, 0, 0, 0, time.UTC)),
					},
					{
						Setpoint: 0,
						Time:     scaler.TimeOfDay(time.Date(0, 1, 1, 11, 0, 0, 0, time.UTC)),
					},
				},
			},
		},
		Driver: scaler.WorkspaceManagerPrescaleDriverConfig{
			WsManager: scaler.WorkspaceManagerConfig{
				Addr: fmt.Sprintf("dns:///%s:%d", wsmanager.Component, wsmanager.RPCPort),
				TLS: &struct {
					CA          string `json:"ca"`
					Certificate string `json:"crt"`
					PrivateKey  string `json:"key"`
				}{
					CA:          "/ws-manager-client-tls-certs/ca.crt",
					Certificate: "/ws-manager-client-tls-certs/tls.crt",
					PrivateKey:  "/ws-manager-client-tls-certs/tls.key",
				},
			},
			WorkspaceImage:     common.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, ""), workspace.DefaultWorkspaceImage, workspace.DefaultWorkspaceImageVersion),
			IDEImage:           common.ImageName(ctx.Config.Repository, ide.CodeIDEImage, ide.CodeIDEImageStableVersion),
			SupervisorImage:    common.ImageName(ctx.Config.Repository, workspace.SupervisorImage, ctx.VersionManifest.Components.Workspace.Supervisor.Version),
			FeatureFlags:       nil,
			MaxGhostWorkspaces: 0,
			SchedulerInterval:  util.Duration(time.Second * 5),
			Renewal: struct {
				Interval   util.Duration `json:"interval"`
				Percentage int           `json:"percentage"`
			}{
				Interval:   util.Duration(time.Minute * 5),
				Percentage: 20,
			},
		},
	}

	wsscfg := config{
		Scheduler: scheduler.Configuration{
			SchedulerName:     "workspace-scheduler",
			Namespace:         ctx.Namespace,
			NodeLabelSelector: map[string]string{},
			StrategyName:      scheduler.StrategyDensityAndExperience,
			DensityAndExperienceConfig: &scheduler.DensityAndExperienceConfig{
				WorkspaceFreshPeriodSeconds: 120,
				NodeFreshWorkspaceLimit:     2,
			},
			// todo(sje): rate limits?
			RateLimit: &scheduler.RateLimitConfig{
				MaxRPS: 10,
			},
		},
		Scaler: scaler,
		PProf: struct {
			Addr string `json:"addr"`
		}{Addr: "localhost:6060"},
		Prometheus: struct {
			Addr string `json:"addr"`
		}{Addr: "127.0.0.1:9500"},
	}

	fc, err := common.ToJSONString(wsscfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-proxy config: %w", err)
	}

	return []runtime.Object{
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
	}, nil
}
