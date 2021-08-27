// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsscheduler

import (
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
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
	}
	Prometheus struct {
		Addr string `json:"addr"`
	} `json:"prometheus"`
	PProf struct {
		Addr string `json:"addr"`
	} `json:"pprof"`
}

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	// todo(sje): scaler?
	scaler := struct {
		Enabled    bool                                        `json:"enabled"`
		Driver     scaler.WorkspaceManagerPrescaleDriverConfig `json:"driver"`
		Controller scaler.ControllerConfig                     `json:"controller"`
	}{}

	wsscfg := config{
		Scheduler: scheduler.Configuration{
			SchedulerName:     "workspace-scheduler",
			Namespace:         ctx.Namespace,
			NodeLabelSelector: map[string]string{},
			StrategyName:      "DensityAndExperience",
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

	fc, err := json.MarshalIndent(wsscfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-proxy config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaNetworkPolicy,
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
