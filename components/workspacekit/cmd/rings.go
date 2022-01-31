// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
)

const (
	// ring1ShutdownTimeout is the time ring1 gets between SIGTERM and SIGKILL.
	// We do this to ensure we have enough time left for ring0 to clean up prior
	// to receiving SIGKILL from the kubelet.
	//
	// This time must give ring1 enough time to shut down (see time budgets in supervisor.go),
	// and to talk to ws-daemon within the terminationGracePeriod of the workspace pod.
	ring1ShutdownTimeout = 20 * time.Second

	// ring2StartupTimeout is the maximum time we wait between starting ring2 and its
	// attempt to connect to the parent socket.
	ring2StartupTimeout = 5 * time.Second
)

func init() {
	rootCmd.AddCommand(ring0Cmd)
	rootCmd.AddCommand(ring1Cmd)
	rootCmd.AddCommand(ring2Cmd)

	supervisorPath := os.Getenv("GITPOD_WORKSPACEKIT_SUPERVISOR_PATH")
	if supervisorPath == "" {
		wd, err := os.Executable()
		if err == nil {
			wd = filepath.Dir(wd)
			supervisorPath = filepath.Join(wd, "supervisor")
		} else {
			supervisorPath = "/.supervisor/supervisor"
		}
	}

	ring1Cmd.Flags().BoolVar(&ring1Opts.MappingEstablished, "mapping-established", false, "true if the UID/GID mapping has already been established")
	ring2Cmd.Flags().StringVar(&ring2Opts.SupervisorPath, "supervisor-path", supervisorPath, "path to the supervisor binary (taken from $GITPOD_WORKSPACEKIT_SUPERVISOR_PATH, defaults to '$PWD/supervisor')")
}

func handleExit(ec *int) {
	exitCode := *ec
	if exitCode != 0 {
		sleepForDebugging()
	}
	os.Exit(exitCode)
}

func sleepForDebugging() {
	if os.Getenv("GITPOD_WORKSPACEKIT_SLEEP_FOR_DEBUGGING") != "true" {
		return
	}

	log.Info("sleeping five minutes to allow debugging")
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	select {
	case <-sigChan:
	case <-time.After(5 * time.Minute):
	}
}

type ringSyncMsg struct {
	Stage   int               `json:"stage"`
	Rootfs  string            `json:"rootfs"`
	FSShift api.FSShiftMethod `json:"fsshift"`
}

type inWorkspaceServiceClient struct {
	daemonapi.InWorkspaceServiceClient

	conn *grpc.ClientConn
}

func (iwsc *inWorkspaceServiceClient) Close() error {
	if iwsc.conn == nil {
		return nil
	}

	return iwsc.conn.Close()
}

// ConnectToInWorkspaceDaemonService attempts to connect to the InWorkspaceService offered by the ws-daemon.
func connectToInWorkspaceDaemonService(ctx context.Context) (*inWorkspaceServiceClient, error) {
	const socketFN = "/.workspace/daemon.sock"

	t := time.NewTicker(500 * time.Millisecond)
	defer t.Stop()
	for {
		if _, err := os.Stat(socketFN); err == nil {
			break
		}

		select {
		case <-t.C:
			continue
		case <-ctx.Done():
			return nil, xerrors.Errorf("socket did not appear before context was canceled")
		}
	}

	conn, err := grpc.DialContext(ctx, "unix://"+socketFN, grpc.WithInsecure())
	if err != nil {
		return nil, err
	}

	return &inWorkspaceServiceClient{
		InWorkspaceServiceClient: daemonapi.NewInWorkspaceServiceClient(conn),
		conn:                     conn,
	}, nil
}

func isProcessAlreadyFinished(err error) bool {
	return strings.Contains(err.Error(), "os: process already finished")
}
