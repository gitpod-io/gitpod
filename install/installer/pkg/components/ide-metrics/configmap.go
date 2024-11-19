// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide_metrics

import (
	"fmt"
	"strconv"

	"github.com/gitpod-io/gitpod/ide-metrics-api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/prometheus/client_golang/prometheus"

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
			Help: "Total number of RPCs started on the server.",
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
		}, {
			Name: "grpc_client_started_total",
			Help: "Total number of RPCs started on the client.",
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
			Client: &config.ClientAllowList{
				Name:         "metric_client",
				AllowValues:  []string{"dashboard", "vscode-desktop-extension", "supervisor", "unknown"},
				DefaultValue: "unknown",
			},
		}, {
			Name: "grpc_client_handled_total",
			Help: "Total number of RPCs completed by the client, regardless of success or failure.",
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
			Client: &config.ClientAllowList{
				Name:         "metric_client",
				AllowValues:  []string{"dashboard", "vscode-desktop-extension", "supervisor", "unknown"},
				DefaultValue: "unknown",
			},
		},
		{
			Name: "supervisor_client_handled_total",
			Help: "Total number of supervisor outgoing services completed by the client, regardless of success or failure.",
			Labels: []config.LabelAllowList{
				{
					Name:        "method",
					AllowValues: []string{"*"},
				},
				{
					Name:        "server",
					AllowValues: []string{"*"},
				},
				{
					Name:        "err_code",
					AllowValues: []string{"*"},
				},
			},
		},
		{
			Name: "vscode_desktop_local_ssh_config_total",
			Help: "Total number of vscode desktop extension config local ssh configuration",
			Labels: []config.LabelAllowList{
				{
					Name:        "status",
					AllowValues: []string{"success", "failure"},
				},
				{
					Name:         "failure_code",
					AllowValues:  []string{"*"},
					DefaultValue: "Unknown",
				},
			},
			Client: &config.ClientAllowList{
				Name:         "metric_client",
				AllowValues:  []string{"vscode-desktop-extension"},
				DefaultValue: "unknown",
			},
		},
		{
			Name: "vscode_desktop_ping_extension_server_total",
			Help: "Total number of vscode desktop extension local ssh extension ipc server ping",
			Labels: []config.LabelAllowList{
				{
					Name:        "status",
					AllowValues: []string{"success", "failure"},
				},
			},
			Client: &config.ClientAllowList{
				Name:         "metric_client",
				AllowValues:  []string{"vscode-desktop-extension"},
				DefaultValue: "unknown",
			},
		},
		{
			Name: "vscode_desktop_local_ssh_total",
			Help: "Total number of vscode desktop local ssh proxy connection",
			Labels: []config.LabelAllowList{
				{
					Name:        "phase",
					AllowValues: []string{"connecting", "connected", "failed"},
				},
				{
					Name:         "failure_code",
					AllowValues:  []string{"*"},
					DefaultValue: "Unknown",
				},
			},
			Client: &config.ClientAllowList{
				Name:         "metric_client",
				AllowValues:  []string{"vscode-desktop-extension"},
				DefaultValue: "unknown",
			},
		},
		{
			Name: "websocket_client_total",
			Help: "Total number of WebSocket connections by the client",
			Labels: []config.LabelAllowList{
				{
					Name:         "origin",
					AllowValues:  []string{"unknown", "workspace", "gitpod", "localhost"},
					DefaultValue: "unknown",
				},
				{
					Name:         "instance_phase",
					AllowValues:  []string{"undefined", "unknown", "preparing", "building", "pending", "creating", "initializing", "running", "interrupted", "stopping", "stopped"},
					DefaultValue: "undefined",
				},
				{
					Name:         "status",
					AllowValues:  []string{"unknown", "new", "open", "error", "close"},
					DefaultValue: "unknown",
				},
				{
					Name:         "code",
					AllowValues:  []string{"*"},
					DefaultValue: "unknown",
				},
				{
					Name:         "was_clean",
					AllowValues:  []string{"unknown", "0", "1"},
					DefaultValue: "unknown",
				},
			},
		},
		{
			Name:   "supervisor_ssh_tunnel_opened_total",
			Help:   "Total number of SSH tunnels opened by the supervisor",
			Labels: []config.LabelAllowList{},
		},
		{
			Name: "supervisor_ssh_tunnel_closed_total",
			Help: "Total number of SSH tunnels closed by the supervisor",
			Labels: []config.LabelAllowList{
				{
					Name:         "code",
					AllowValues:  []string{"*"},
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
		{
			Name:    "supervisor_ide_ready_duration_total",
			Help:    "the IDE startup time",
			Buckets: []float64{0.1, 0.5, 1, 1.5, 2, 2.5, 5, 10},
			Labels: []config.LabelAllowList{
				{
					Name:        "kind",
					AllowValues: []string{"web", "desktop"},
				},
			},
		},
		{
			Name:    "supervisor_initializer_bytes_second",
			Help:    "initializer speed in bytes per second",
			Buckets: prometheus.ExponentialBuckets(1024*1024, 2, 12),
			Labels: []config.LabelAllowList{
				{
					Name:        "kind",
					AllowValues: []string{"*"},
				},
			},
		}, {
			Name: "grpc_client_handling_seconds",
			Help: "Histogram of response latency (seconds) of the gRPC until it is finished by the application.",
			Labels: []config.LabelAllowList{
				{
					Name:        "grpc_type",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_service",
					AllowValues: []string{"*"},
				},
				{
					Name:        "grpc_method",
					AllowValues: []string{"*"},
				},
			},
			Buckets: []float64{0.1, 0.2, 0.5, 1, 2, 5, 10},
			Client: &config.ClientAllowList{
				Name:         "metric_client",
				AllowValues:  []string{"dashboard", "vscode-desktop-extension", "supervisor", "unknown"},
				DefaultValue: "unknown",
			},
		}, {
			Name: "supervisor_client_handling_seconds",
			Help: "Histogram of response latency (seconds) of the supervisor outgoing services until it is finished by the application.",
			Labels: []config.LabelAllowList{
				{
					Name:        "method",
					AllowValues: []string{"*"},
				},
				{
					Name:        "server",
					AllowValues: []string{"*"},
				},
				{
					Name:        "err_code",
					AllowValues: []string{"*"},
				},
			},
			Buckets: []float64{0.1, 0.2, 0.5, 1, 2, 5, 10},
		},
	}

	errorReporting := config.ErrorReportingConfiguration{
		AllowComponents: []string{
			"supervisor-frontend",
			// "vscode-workbench",
			// "vscode-server",
			// "vscode-web",
			"gitpod-cli",
			"gitpod-web",
			"gitpod-remote-ssh",
			"vscode-desktop-extension",
			"dashboard",
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
