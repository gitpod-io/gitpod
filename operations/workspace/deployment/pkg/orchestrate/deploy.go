// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package orchestrate

import (
	"sync"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/step"
)

func Deploy(context *common.ProjectContext, clusters []*common.WorkspaceCluster) error {
	var wg sync.WaitGroup
	wg.Add(len(clusters))

	for _, cluster := range clusters {
		go func(context *common.ProjectContext, cluster *common.WorkspaceCluster) {
			defer wg.Done()
			err := step.CreateCluster(context, cluster)
			if err != nil {
				log.Log.Infof("error creating cluster %s: %s", cluster.Name, err)
			}
		}(context, cluster)
	}
	wg.Wait()
	return nil
}
