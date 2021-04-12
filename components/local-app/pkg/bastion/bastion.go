// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package bastion

import (
	"context"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/sirupsen/logrus"
)

type Workspace struct {
	Name  string
	Phase string
}

type Callbacks interface {
	InstanceUpdate(*Workspace)
}

func New(client gitpod.APIInterface, cb Callbacks) *Bastion {
	ctx, cancel := context.WithCancel(context.Background())
	return &Bastion{
		Client:     client,
		Callbacks:  cb,
		workspaces: make(map[string]*Workspace),
		ctx:        ctx,
		stop:       cancel,
	}
}

type Bastion struct {
	Client    gitpod.APIInterface
	Callbacks Callbacks

	workspaces map[string]*Workspace

	ctx  context.Context
	stop context.CancelFunc
}

func (b *Bastion) Run() error {
	updates, err := b.Client.InstanceUpdates(b.ctx, "")
	if err != nil {
		return err
	}

	wss, err := b.Client.GetWorkspaces(b.ctx, &gitpod.GetWorkspacesOptions{Limit: float64(100)})
	if err != nil {
		logrus.WithError(err).Warn("cannot get workspaces")
	} else {
		for _, ws := range wss {
			if ws.LatestInstance == nil || ws.LatestInstance.Status.Phase != "running" {
				continue
			}
			w := &Workspace{
				Name:  ws.Workspace.ID,
				Phase: "running",
			}
			b.workspaces[ws.LatestInstance.ID] = w
			b.Callbacks.InstanceUpdate(w)
		}
	}

	for u := range updates {
		w, ok := b.workspaces[u.WorkspaceID]
		if !ok {
			w = &Workspace{}
			b.workspaces[u.WorkspaceID] = w
		}

		w.Name = u.WorkspaceID
		w.Phase = u.Status.Phase
		b.Callbacks.InstanceUpdate(w)
	}
	return nil
}
