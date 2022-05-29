// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package detector

import (
	"context"
	"strings"
	"time"

	"github.com/cilium/tetragon/api/v1/tetragon"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/procfs"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type TetragonProcDetector struct {
	client tetragon.FineGuidanceSensorsClient
	procFs procfs.FS
}

func NewTetragonProcDetector(address string) (*TetragonProcDetector, error) {
	connCtx, connCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer connCancel()

	conn, err := grpc.DialContext(connCtx, address, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		return nil, xerrors.Errorf("could not establish connection to tetragon: %w", err)
	}

	client := tetragon.NewFineGuidanceSensorsClient(conn)

	procFs, err := procfs.NewFS("/proc")
	if err != nil {
		return nil, err
	}

	return &TetragonProcDetector{
		client: client,
		procFs: procFs,
	}, nil
}

func (t *TetragonProcDetector) Discover(ctx context.Context) (<-chan Process, error) {
	eventChan := make(chan Process)

	events, err := t.client.GetEvents(ctx, &tetragon.GetEventsRequest{})
	if err != nil {
		return nil, xerrors.Errorf("could not subscribe to events: %w", err)
	}

	go func() {
		for {

			resp, err := events.Recv()
			if err != nil {
				log.Errorf("could not receive events: %w", err)
				return
			}

			if evt, ok := resp.Event.(*tetragon.GetEventsResponse_ProcessExec); ok {
				execProc := evt.ProcessExec.Process

				if !strings.HasPrefix(execProc.Pod.Name, "ws-") {
					continue
				}

				cmdLine := strings.Split(evt.ProcessExec.Process.Arguments, " ")
				var kind ProcessKind
				var workspace *common.Workspace
				if isSupervisor(cmdLine) {
					kind = ProcessSupervisor
				} else if isWorkspacekit(cmdLine) {
					kind = ProcessSandbox
					workspace = extractWorkspaceFromWorkspacekit(realProcfs(t.procFs), int(execProc.Pid.Value))
				} else {
					kind = ProcessUserWorkload
				}

				processs := Process{
					Path:        evt.ProcessExec.Process.Binary,
					CommandLine: cmdLine,
					Kind:        kind,
					Workspace:   workspace,
				}

				eventChan <- processs
			}
		}
	}()

	return eventChan, nil
}

func isWorkspacekit(cmdLine []string) bool {
	return len(cmdLine) >= 2 && cmdLine[0] == "/proc/self/exe" && cmdLine[1] == "ring1"
}
