// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package observer

import (
	"time"

	"github.com/gitpod-io/gitpod/loadgen/pkg/loadgen"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

const (
	defaultCapacity = 200
)

// Stats is stats across a whole session
type Stats struct {
	Total   int           `json:"total"`
	Failed  int           `json:"failed"`
	Running int           `json:"running"`
	Samples []StatsSample `json:"samples"`
}

// StatsSample is a single workspace sample
type StatsSample struct {
	InstanceID     string
	Start, Running time.Time
	Phase          api.WorkspacePhase
	Failed         bool
	StartDuration  time.Duration
}

// NewStatsObserver produces a stats collecting observer
func NewStatsObserver(cb func(*Stats)) chan<- *loadgen.SessionEvent {
	res := make(chan *loadgen.SessionEvent, defaultCapacity)

	publishStats := func(status map[string]*StatsSample) {
		var s Stats
		s.Samples = make([]StatsSample, 0, len(status))
		for _, ws := range status {
			s.Total++
			if ws.Failed {
				s.Failed++
			}
			if ws.Phase == api.WorkspacePhase_RUNNING {
				s.Running++
			}
			s.Samples = append(s.Samples, *ws)
		}

		cb(&s)
	}

	go func() {
		status := make(map[string]*StatsSample)
		for evt := range res {
			switch evt.Kind {
			case loadgen.SessionStart:
				status = make(map[string]*StatsSample)
			case loadgen.SessionWorkspaceStart:
				status[evt.WorkspaceStart.Spec.Id] = &StatsSample{
					InstanceID:    evt.WorkspaceStart.Spec.Id,
					Start:         evt.WorkspaceStart.Time,
					Failed:        false,
					Phase:         api.WorkspacePhase_UNKNOWN,
					StartDuration: evt.WorkspaceStart.CallDuration,
				}
			case loadgen.SessionWorkspaceUpdate:
				up := evt.WorkspaceUpdate.Update
				ws, ok := status[up.InstanceID]
				if !ok {
					continue
				}
				ws.Phase = up.Phase
				ws.Failed = up.Failed
				ws.Running = evt.WorkspaceUpdate.Time
				publishStats(status)
			case loadgen.SessionDone:
				publishStats(status)
			}
		}
	}()
	return res
}
