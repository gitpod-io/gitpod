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
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type TetragonProcDetector struct {
	client     tetragon.FineGuidanceSensorsClient
	procFs     realProcfs
	workspaces map[string]int32
}

func NewTetragonProcDetector(address string) (*TetragonProcDetector, error) {
	connCtx, connCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer connCancel()

	conn, err := grpc.DialContext(connCtx, address, grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithBlock())
	if err != nil {
		return nil, xerrors.Errorf("could not establish connection to tetragon: %w", err)
	}

	client := tetragon.NewFineGuidanceSensorsClient(conn)

	procFs := realProcfs{}

	// procFs, err := procfs.NewFS("/proc")
	// if err != nil {
	// 	return nil, err
	// }

	return &TetragonProcDetector{
		client:     client,
		procFs:     procFs,
		workspaces: make(map[string]int32),
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
				log.Errorf("could not receive events: %v", err)
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

func (t *TetragonProcDetector) WatchNetwork(ctx context.Context) error {
	events, err := t.client.GetEvents(ctx, &tetragon.GetEventsRequest{})
	if err != nil {
		return xerrors.Errorf("could not subscribe to events: %w", err)
	}

	go func() {
		for {

			resp, err := events.Recv()
			if err != nil {
				log.Errorf("could not receive events: %v", err)
				return
			}

			switch e := resp.Event.(type) {
			case *tetragon.GetEventsResponse_ProcessExec:
				if e.ProcessExec.Process.Pod != nil && len(e.ProcessExec.Process.Pod.Name) > 0 {
					//proc := e.ProcessExec.Process
					//log.Infof("Process exec in pod %s, binary: %v, arguments: %v", proc.Pod.Name, proc.Binary, proc.Arguments)
				}
			case *tetragon.GetEventsResponse_ProcessKprobe:
				kprobe := e.ProcessKprobe

				if workspaceFilter(kprobe.Process) {
					log.Infof("Kprobe in pod %s, args: %v", kprobe.Process.Binary, kprobe.Process.Arguments)
					log.Infof("struct %v", kprobe)

					if kprobe.FunctionName == "tcp_connect" {
						ws := extractWorkspaceFromWorkspacekit(t.procFs, int(kprobe.Process.Pid.Value))
						if _, ok := t.workspaces[ws.InstanceID]; !ok {
							t.workspaces[ws.InstanceID] = 0
						}

						t.workspaces[ws.InstanceID] = t.workspaces[ws.InstanceID] + 1
						log.Infof("Number of connections for ws %s is %v", ws.InstanceID, t.workspaces[ws.InstanceID])
					}

					if kprobe.FunctionName == "tcp_close" {
						ws := extractWorkspaceFromWorkspacekit(t.procFs, int(kprobe.Process.Pid.Value))
						if ws == nil {
							log.Info("process is already gone")
						}
						if _, ok := t.workspaces[ws.InstanceID]; !ok {
							t.workspaces[ws.InstanceID] = 0
						}

						t.workspaces[ws.InstanceID] = t.workspaces[ws.InstanceID] - 1
						log.Infof("Number of connections for ws %s is %v", ws.InstanceID, t.workspaces[ws.InstanceID])
					}

					// for _, a := range kprobe.Args {
					// 	a.GetArg()
					// }
				}
			}
		}
	}()

	return nil
}

func isWorkspacekit(cmdLine []string) bool {
	return len(cmdLine) >= 2 && cmdLine[0] == "/proc/self/exe" && cmdLine[1] == "ring1"
}

func workspaceFilter(process *tetragon.Process) bool {
	return process.Pod != nil &&
		strings.HasPrefix(process.Pod.Name, "ws-") &&
		process.Pod.Container.Name == "workspace" &&
		process.Binary != "/.supervisor/supervisor"
}
