// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package observer

import (
	log "github.com/sirupsen/logrus"

	"github.com/gitpod-io/gitpod/loadgen/pkg/loadgen"
)

// NewLogObserver produces a new observer that logs using logrus
func NewLogObserver(errorOnly bool) chan<- *loadgen.SessionEvent {
	res := make(chan *loadgen.SessionEvent, defaultCapacity)
	go func() {
		for evt := range res {
			if errorOnly && evt.Kind != loadgen.SessionError {
				continue
			}

			switch evt.Kind {
			case loadgen.SessionStart:
				log.Info("session started")
			case loadgen.SessionWorkspaceStart:
				log.WithField("instanceID", evt.WorkspaceStart.Spec.Id).Info("workspace started")
			case loadgen.SessionError:
				log.WithError(evt.Error).Error("error")
			case loadgen.SessionWorkspaceUpdate:
				up := evt.WorkspaceUpdate.Update
				log.WithField("instanceID", up.InstanceID).WithField("failed", up.Failed).WithField("phase", up.Phase).Info("workspace update")
			case loadgen.SessionDone:
				log.Info("session done")
			}
		}
	}()
	return res
}
