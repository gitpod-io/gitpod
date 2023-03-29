// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package observer

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/loadgen/pkg/loadgen"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

type SuccessObserver struct {
	workspaces  map[string]*workspaceSuccess
	m           sync.Mutex
	successRate float32
}

type workspaceSuccess struct {
	Phase  api.WorkspacePhase
	Failed bool
}

func NewSuccessObserver(successRate float32) *SuccessObserver {
	return &SuccessObserver{
		workspaces:  make(map[string]*workspaceSuccess),
		successRate: successRate,
	}
}

func (o *SuccessObserver) Observe() chan<- *loadgen.SessionEvent {
	res := make(chan *loadgen.SessionEvent, defaultCapacity)

	go func() {
		for evt := range res {
			switch evt.Kind {
			case loadgen.SessionWorkspaceStart:
				o.m.Lock()
				o.workspaces[evt.WorkspaceStart.Spec.Id] = &workspaceSuccess{}
				o.m.Unlock()

			case loadgen.SessionWorkspaceUpdate:
				{
					up := evt.WorkspaceUpdate.Update
					o.m.Lock()
					ws, ok := o.workspaces[up.InstanceID]
					o.m.Unlock()
					if !ok {
						continue
					}

					ws.Phase = up.Phase
					ws.Failed = up.Failed
				}
			}
		}
	}()

	return res
}

func (o *SuccessObserver) Wait(ctx context.Context, expected int) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			o.m.Lock()
			running := 0
			var stopped []string
			for id, ws := range o.workspaces {
				switch ws.Phase {
				case api.WorkspacePhase_RUNNING:
					running += 1
				case api.WorkspacePhase_STOPPED:
					stopped = append(stopped, id)
				}
			}

			if float32(running) >= float32(len(o.workspaces))*o.successRate {
				return nil
			}

			// Quit early if too many workspaces have stopped already. They'll never become ready.
			maxRunning := len(o.workspaces) - len(stopped)
			if float32(maxRunning) < float32(len(o.workspaces))*o.successRate {
				return fmt.Errorf("too many workspaces in stopped state (%d), will never get enough ready workspaces. Stopped workspaces: %v", len(stopped), strings.Join(stopped, ", "))
			}

			o.m.Unlock()
		case <-ctx.Done():
			o.m.Lock()
			log.Warnf("workspaces did not get ready in time. Expected %v workspaces, did see %v", expected, len(o.workspaces))
			for id, ws := range o.workspaces {
				if ws.Phase != api.WorkspacePhase_RUNNING {
					log.Warnf("workspace %s is in phase %v", id, ws.Phase)
				}
			}
			o.m.Unlock()
			return fmt.Errorf("timeout waiting for workspace to get ready")
		}
	}
}
