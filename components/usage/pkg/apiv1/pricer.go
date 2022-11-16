// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/db"
)

const (
	defaultWorkspaceClass = "default"
)

var (
	DefaultWorkspacePricer, _ = NewWorkspacePricer(map[string]float64{
		// 1 credit = 6 minutes
		"default": float64(1) / float64(6),
	})
)

func NewWorkspacePricer(creditMinutesByWorkspaceClass map[string]float64) (*WorkspacePricer, error) {
	if _, ok := creditMinutesByWorkspaceClass[defaultWorkspaceClass]; !ok {
		return nil, fmt.Errorf("credits per minute not defined for expected workspace class 'default'")
	}

	return &WorkspacePricer{creditMinutesByWorkspaceClass: creditMinutesByWorkspaceClass}, nil
}

type WorkspacePricer struct {
	creditMinutesByWorkspaceClass map[string]float64
}

func (p *WorkspacePricer) CreditsUsedByInstance(instance *db.WorkspaceInstanceForUsage, stopTimeIfStillRunning time.Time) float64 {
	runtime := instance.WorkspaceRuntimeSeconds(stopTimeIfStillRunning)
	class := defaultWorkspaceClass
	if instance.WorkspaceClass != "" {
		class = instance.WorkspaceClass
	}
	return p.Credits(class, runtime)
}

func (p *WorkspacePricer) Credits(workspaceClass string, runtimeInSeconds int64) float64 {
	inMinutes := float64(runtimeInSeconds) / 60
	return p.CreditsPerMinuteForClass(workspaceClass) * inMinutes
}

func (p *WorkspacePricer) CreditsPerMinuteForClass(workspaceClass string) float64 {
	if creditsForClass, ok := p.creditMinutesByWorkspaceClass[workspaceClass]; ok {
		return creditsForClass
	}
	return p.creditMinutesByWorkspaceClass[defaultWorkspaceClass]
}
