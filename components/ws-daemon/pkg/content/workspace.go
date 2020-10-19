// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content

import (
	"context"
	"math/rand"
	"os/exec"
	"sync"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

//
// BEWARE
// The code in this file, i.e. everything offered by WorkspaceBackupServer is accessible without further protection
// by user-reachable code. There's no server or ws-man in front of this interface. Keep this interface minimal, and
// be defensive!
//

const (
	// time between calls is the time that has to pass until we answer an RPC call again
	timeBetweenCalls = 10 * time.Second
)

// WorkspaceBackupServer implements the workspace facing backup services
type WorkspaceBackupServer struct {
	LiveBackup *LiveWorkspaceBackup

	lastCall time.Time
	mu       sync.Mutex
}

// serveWorkspace creates a new WorkspaceBackupServer and makes it available in the workspace
// using a Unix socket serving a gRPC server.
func serveWorkspace(namespace string) func(ctx context.Context, ws *session.Workspace) error {
	return func(ctx context.Context, ws *session.Workspace) error {
		lb, ok := ws.NonPersistentAttrs[session.AttrLiveBackup].(*LiveWorkspaceBackup)
		if ws.FullWorkspaceBackup && (lb == nil || !ok) {
			return xerrors.Errorf("cannot start workspace server - workspace has no live backup configured")
		}
		// lb might still be nil here, if the workspace doesn't need a full workspace backup.
		// That's ok as *LiveWorkspaceBackup can handle nil references gracefully.

		host := wsk8s.WorkspaceSupervisorEndpoint(ws.WorkspaceID, namespace)
		conn, err := grpc.DialContext(ctx, host, grpc.WithInsecure())
		if err != nil {
			return err
		}

		serviceCtx, cancel := context.WithCancel(context.Background())
		ws.NonPersistentAttrs[session.AttrWorkspaceServer] = cancel

		var (
			cl       = api.NewInWorkspaceHelperClient(conn)
			attempts = 0
		)
		go func() {
			log.WithFields(ws.OWI()).Info("serving workspace helper")
			for {
				if serviceCtx.Err() != nil {
					log.WithError(err).WithFields(ws.OWI()).Info("stopping workspace server")
					return
				}

				teardownCanary, err := cl.TeardownCanary(serviceCtx)
				if err != nil {
					if s, ok := status.FromError(err); ok && s.Code() == codes.Unavailable {
						attempts++
						if attempts%10 == 0 {
							log.WithFields(ws.OWI()).WithError(err).WithField("attempts", attempts).Debug("teardown canary unavailable - maybe because of workspace shutdown")
						}
					} else {
						log.WithFields(ws.OWI()).WithError(err).Warn("teardown canary failure")
					}

					// we want to retry quickly here to establish the backup ability ASAP
					time.Sleep(1 * time.Second)
					continue
				}

				_, err = teardownCanary.Recv()
				if err != nil {
					if ctx.Err() == nil {
						// we weren't asked to stop serving the workspace yet, and still
						// something has failed. We should be loud about that.
						log.WithFields(ws.OWI()).WithError(err).Warn("teardown canary failure")
					}

					teardownCanary.CloseSend()
					time.Sleep(time.Duration(rand.Intn(5)) * time.Second)
					continue
				}

				var success bool
				_, err = lb.Backup()
				if err != nil {
					success = false
					log.WithFields(ws.OWI()).WithError(err).Error("live backup failure")
				} else {
					log.WithFields(ws.OWI()).WithError(err).Info("live backup succeeded")
				}

				gitStatus, err := cl.GitStatus(serviceCtx, &api.GitStatusRequest{})
				if err != nil {
					success = false
					log.WithFields(ws.OWI()).WithError(err).Warn("cannot get Git status")
				} else {
					ws.SetGitStatus(gitStatus.Repo)
				}

				if ws.ShiftfsMarkMount != "" {
					// We cannot use the nsenter syscall here because mount namespaces affect the whole process, not just the current thread.
					// That's why we resort to exec'ing "nsenter ... unmount ...".
					mntout, err := exec.Command("nsenter", "-t", "1", "-m", "--", "umount", ws.ShiftfsMarkMount).CombinedOutput()
					if err != nil {
						log.WithFields(ws.OWI()).WithField("shiftfsMarkMount", ws.ShiftfsMarkMount).WithField("mntout", string(mntout)).WithError(err).Error("cannot unmount shiftfs mark")
						success = false
					}
				}

				teardownCanary.Send(&api.TeardownResponse{Success: success})

				teardownCanary.CloseSend()
				time.Sleep(timeBetweenCalls)
			}
		}()

		return nil
	}
}

// stopServingWorkspace stops any formerly created WorkspaceBackupServer and removes any sockets
// pointing to it.
func stopServingWorkspace(ctx context.Context, ws *session.Workspace) error {
	cancel, ok := ws.NonPersistentAttrs[session.AttrWorkspaceServer].(context.CancelFunc)
	if cancel == nil || !ok {
		return nil
	}

	cancel()
	return nil
}
