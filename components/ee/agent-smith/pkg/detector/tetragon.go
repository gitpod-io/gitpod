// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package detector

import (
	"context"
	"strings"
	"time"

	"github.com/cilium/tetragon/api/v1/tetragon"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type TetragonDetector struct {
	tetragon      tetragon.FineGuidanceSensorsClient
	workspacePods map[string]uint32
	connections   *prometheus.GaugeVec
}

func NewTetragonDetector(address string) (*TetragonDetector, error) {
	connCtx, connCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer connCancel()

	conn, err := grpc.DialContext(connCtx, address, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		return nil, xerrors.Errorf("could not establish connection to tetragon: %w", err)
	}

	tetragon := tetragon.NewFineGuidanceSensorsClient(conn)

	workspaceConnections := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "gitpod",
			Subsystem: "agent_smith",
			Name:      "workspace_tcp_connections_total",
			Help:      "The total number of tpc connections a workspace has currently open.",
		}, []string{"workspace"},
	)

	return &TetragonDetector{
		tetragon:      tetragon,
		workspacePods: make(map[string]uint32),
		connections:   workspaceConnections,
	}, nil
}

func (t *TetragonDetector) Watch(ctx context.Context) error {
	events, err := t.tetragon.GetEvents(ctx, &tetragon.GetEventsRequest{
		AllowList: []*tetragon.Filter{
			{
				EventSet: []tetragon.EventType{tetragon.EventType_PROCESS_KPROBE},
			},
		},
	})
	if err != nil {
		return xerrors.Errorf("could not subscribe to events: %w", err)
	}

	go func() {
		for {
			resp, err := events.Recv()
			if err != nil {
				log.Warnf("could not receive event: %v", err)
				return
			}

			if evt, ok := resp.Event.(*tetragon.GetEventsResponse_ProcessKprobe); ok {
				if isWorkspaceProcess(evt.ProcessKprobe.Process) {
					wsName := evt.ProcessKprobe.Process.Pod.Name

					switch evt.ProcessKprobe.FunctionName {
					case "tcp_connect":
						if _, ok := t.workspacePods[wsName]; !ok {
							t.workspacePods[wsName] = 0
						}

						t.workspacePods[wsName] = t.workspacePods[wsName] + 1
						t.connections.WithLabelValues(wsName).Add(float64(t.workspacePods[wsName]))
						log.Infof("Number of connections for %s is %v", wsName, t.workspacePods[wsName])
					case "tcp_close":
						if _, ok := t.workspacePods[wsName]; !ok {
							continue
						}

						if t.workspacePods[wsName] <= 0 {
							continue
						}

						t.workspacePods[wsName] = t.workspacePods[wsName] - 1
						t.connections.WithLabelValues(wsName).Add(float64(t.workspacePods[wsName]))
						log.Infof("Number of connections for %s is %v", wsName, t.workspacePods[wsName])
					}
				}
			}
		}
	}()

	return nil
}

func (t *TetragonDetector) Describe(d chan<- *prometheus.Desc) {
	t.connections.Describe(d)
}

func (t *TetragonDetector) Collect(m chan<- prometheus.Metric) {
	t.connections.Collect(m)
}

func isWorkspaceProcess(process *tetragon.Process) bool {
	return process.Pod != nil &&
		strings.HasPrefix(process.Pod.Name, "ws-") &&
		process.Pod.Container.Name == "workspace"
}
