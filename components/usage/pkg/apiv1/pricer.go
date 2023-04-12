// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
)

const (
	defaultPrice = float64(1) / float64(6)
)

var (
	DefaultWorkspacePricer, _ = NewWorkspacePricer(map[string]float64{})
)

func NewWorkspacePricer(creditMinutesByWorkspaceClass map[string]float64) (*WorkspacePricer, error) {
	return &WorkspacePricer{creditMinutesByWorkspaceClass: creditMinutesByWorkspaceClass}, nil
}

type WorkspacePricer struct {
	creditMinutesByWorkspaceClass map[string]float64
}

func (p *WorkspacePricer) CreditsUsedByInstance(instance *db.WorkspaceInstanceForUsage, stopTimeIfStillRunning time.Time) float64 {
	runtime := instance.WorkspaceRuntimeSeconds(stopTimeIfStillRunning)
	return p.Credits(instance.WorkspaceClass, runtime)
}

func (p *WorkspacePricer) Credits(workspaceClass string, runtimeInSeconds int64) float64 {
	inMinutes := float64(runtimeInSeconds) / 60
	return p.CreditsPerMinuteForClass(workspaceClass) * inMinutes
}

func (p *WorkspacePricer) CreditsPerMinuteForClass(workspaceClass string) float64 {
	if creditsForClass, ok := p.creditMinutesByWorkspaceClass[workspaceClass]; ok {
		return creditsForClass
	}
	log.Errorf("No credit minutes configured for workspace class %q - using default price of %v credits per minute", workspaceClass, defaultPrice)
	return defaultPrice
}
