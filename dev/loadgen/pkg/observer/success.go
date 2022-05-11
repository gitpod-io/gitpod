package observer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/loadgen/pkg/loadgen"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

type SuccessObserver struct {
	workspaces map[string]*workspaceSuccess
	m          sync.Mutex
}

type workspaceSuccess struct {
	Phase  api.WorkspacePhase
	Failed bool
}

func NewSuccessObserver() *SuccessObserver {
	return &SuccessObserver{
		workspaces: make(map[string]*workspaceSuccess),
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
			if len(o.workspaces) == expected {
				running := true
				for _, ws := range o.workspaces {
					if ws.Phase != api.WorkspacePhase_RUNNING {
						running = false
					}
				}

				if running {
					return nil
				}
			}
			o.m.Unlock()
		case <-ctx.Done():
			log.Warn("workspaces did not get ready in time")
			o.m.Lock()
			for id, ws := range o.workspaces {
				log.Warnf("workspace %s is in phase %v", id, ws.Phase)
			}
			o.m.Unlock()
			return fmt.Errorf("timeout out waiting for workspace to get ready")
		}
	}
}
