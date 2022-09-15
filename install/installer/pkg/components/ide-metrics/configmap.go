// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide_metrics

import (
	"fmt"
	"strconv"

	"github.com/gitpod-io/gitpod/ide-metrics-api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var statusCodes []string
	for statusCode := 100; statusCode < 600; statusCode++ {
		statusCodes = append(statusCodes, strconv.Itoa(statusCode))
	}
	statusCodes = append(statusCodes, "unknown")

	counterMetrics := []config.CounterMetricsConfiguration{
		{
			Name: "gitpod_supervisor_frontend_error_total",
			Help: "Total count of supervisor frontend client errors",
			Labels: []config.LabelAllowList{
				{
					Name: "resource",
					AllowValues: []string{
						"vscode-web-workbench",
						"unknown",
					},
					DefaultValue: "unknown",
				},
				{
					Name: "error",
					AllowValues: []string{
						"LoadError", // js script style of errors
						"Unknown",
					},
					DefaultValue: "Unknown",
				},
			},
		},
		{
			Name: "gitpod_vscode_web_load_total",
			Help: "Total count of attempts to load VS Code Web workbench",
			Labels: []config.LabelAllowList{
				{
					Name:        "status",
					AllowValues: []string{"loading", "failed"},
				},
			},
		},
		{
			Name: "gitpod_supervisor_frontend_client_total",
			Help: "Total count of supervisor frontend client",
		},
		{
			Name: "gitpod_vscode_extension_gallery_operation_total",
			Help: "Total count of extension operations",
			Labels: []config.LabelAllowList{
				{
					Name:         "operation",
					AllowValues:  []string{"install", "update", "uninstall", "unknown"},
					DefaultValue: "unknown",
				},
				{
					Name:         "status",
					AllowValues:  []string{"success", "failure", "unknown"},
					DefaultValue: "unknown",
				},
				// TODO(ak) errorCode - we should analyze error codes collect in analytics and categotize them here
			},
		},
		{
			Name: "gitpod_vscode_extension_gallery_query_total",
			Help: "Total count of extension gallery queries",
			Labels: []config.LabelAllowList{
				{
					Name:         "status",
					AllowValues:  []string{"success", "failure", "unknown"},
					DefaultValue: "unknown",
				},
				{
					Name:         "statusCode",
					AllowValues:  statusCodes,
					DefaultValue: "unknown",
				},
				{
					Name:         "errorCode",
					AllowValues:  []string{"canceled", "timeout", "failed", "unknown"},
					DefaultValue: "unknown",
				},
			},
		},
	}

	histogramMetrics := []config.HistogramMetricsConfiguration{
		{
			Name: "gitpod_vscode_extension_gallery_operation_duration_seconds",
			Help: "Duration of extension operations in seconds",
			Labels: []config.LabelAllowList{
				{
					Name:         "operation",
					AllowValues:  []string{"install", "update", "uninstall", "unknown"},
					DefaultValue: "unknown",
				},
			},
			Buckets: []float64{0.1, 0.5, 1, 5, 10, 15, 30},
		}, {
			Name:    "gitpod_vscode_extension_gallery_query_duration_seconds",
			Help:    "Duration of extension gallery query in seconds",
			Buckets: []float64{0.1, 0.5, 1, 5, 10, 15, 30},
		},
	}

	errorReporting := config.ErrorReportingConfiguration{
		AllowComponents: []string{
			"supervisor-frontend",
			"vscode-workbench",
		},
	}

	cfg := config.ServiceConfiguration{
		Server: config.MetricsServerConfiguration{
			Port: ContainerPort,
			// RateLimits: , // TODO(pd) ratelimit
			CounterMetrics:   counterMetrics,
			HistogramMetrics: histogramMetrics,
			ErrorReporting:   errorReporting,
		},
		Prometheus: struct {
			Addr string `json:"addr"`
		}{Addr: common.LocalhostPrometheusAddr()},
	}

	fc, err := common.ToJSONString(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ide-metrics config: %w", err)
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
	}
	return res, nil
}
