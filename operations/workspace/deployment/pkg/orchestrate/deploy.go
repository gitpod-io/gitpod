// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package orchestrate

import (
	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/step"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"
)

// Deploy creates given workspace clusters and then deploys gitpod on them
func Deploy(context *common.Context, clusters []*common.WorkspaceCluster) error {
	eg := new(errgroup.Group)
	for _, c := range clusters {
		c := c
		eg.Go(func() error {
			err := createCluster(context, c)
			if err != nil {
				return err
			}
			err = installGitpod(context, c)
			if err != nil {
				return err
			}
			return nil
		})
	}
	if err := eg.Wait(); err != nil {
		return xerrors.New(err.Error())
	}
	return nil
}

// TODO(prs): Add implementation once we have scripts in ops repo tested and
// install step implemented
func installGitpod(context *common.Context, cluster *common.WorkspaceCluster) error {
	log.Log.Infof("received request to install gitpod on cluster: %s cannot be processed. Implementation pending", cluster.Name)
	return nil
}

func createCluster(context *common.Context, cluster *common.WorkspaceCluster) error {
	// TODO(prs): add retry logic below
	err := step.CreateCluster(context, cluster)
	if err != nil {
		log.Log.Infof("error creating cluster %s: %s", cluster.Name, err)
	}
	return err
}
