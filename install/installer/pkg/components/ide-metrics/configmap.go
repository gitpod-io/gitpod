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
		// we could also create a generator later similar to https://github.com/grpc/grpc-go/tree/master/cmd/protoc-gen-go-grpc if there is abuse
		{
			Name: "grpc_server_handled_total",
			Help: "Total number of RPCs completed on the server, regardless of success or failure.",
			Labels: []config.LabelAllowList{
				{
					Name:        "grpc_method",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_service",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_type",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_code",
					AllowValues: []string{"*"},
				},
			},
		},
		{
			Name: "grpc_server_msg_received_total",
			Help: "Total number of RPC stream messages received on the server.",
			Labels: []config.LabelAllowList{
				{
					Name:        "grpc_method",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_service",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_type",
					AllowValues: []string{"*"},
				},
			},
		},
		{
			Name: "grpc_server_msg_sent_total",
			Help: "Total number of gRPC stream messages sent by the server.",
			Labels: []config.LabelAllowList{
				{
					Name:        "grpc_method",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_service",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_type",
					AllowValues: []string{"*"},
				},
			},
		},
		{
			Name: "grpc_server_started_total",
			Help: "Total number of RPCs started on the server",
			Labels: []config.LabelAllowList{
				{
					Name:        "grpc_method",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_service",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_type",
					AllowValues: []string{"*"},
				},
			},
		},
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
				{
					Name:        "galleryHost",
					AllowValues: []string{"*"},
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
				{
					Name:        "galleryHost",
					AllowValues: []string{"*"},
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
				{
					Name:        "galleryHost",
					AllowValues: []string{"*"},
				},
			},
			Buckets: []float64{0.1, 0.5, 1, 5, 10, 15, 30},
		}, {
			Name: "gitpod_vscode_extension_gallery_query_duration_seconds",
			Help: "Duration of extension gallery query in seconds",
			Labels: []config.LabelAllowList{
				{
					Name:        "galleryHost",
					AllowValues: []string{"*"},
				},
			},
			Buckets: []float64{0.1, 0.5, 1, 5, 10, 15, 30},
		},
	}

	aggregatedHistogramMetrics := []config.HistogramMetricsConfiguration{
		// we could also create a generator later similar to https://github.com/grpc/grpc-go/tree/master/cmd/protoc-gen-go-grpc if there is abuse
		{
			Name: "grpc_server_handling_seconds",
			Help: "Histogram of response latency (seconds) of gRPC that had been application-level handled by the server.",
			Labels: []config.LabelAllowList{
				{
					Name:        "grpc_method",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_service",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_type",
					AllowValues: []string{"*"},
				},
			},
			Buckets: []float64{.005, .025, .05, .1, .5, 1, 2.5, 5, 30, 60, 120, 240, 600},
		},
	}

	errorReporting := config.ErrorReportingConfiguration{
		AllowComponents: []string{
			"supervisor-frontend",
			"vscode-workbench",
			"vscode-server",
			"vscode-web",
			"gitpod-cli",
		},
	}

	cfg := config.ServiceConfiguration{
		Server: config.MetricsServerConfiguration{
			Port: ContainerPort,
			// RateLimits: , // TODO(pd) ratelimit
			CounterMetrics:             counterMetrics,
			HistogramMetrics:           histogramMetrics,
			AggregatedHistogramMetrics: aggregatedHistogramMetrics,
			ErrorReporting:             errorReporting,
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
