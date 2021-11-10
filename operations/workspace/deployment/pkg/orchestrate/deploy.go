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

func installGitpod(context *common.Context, cluster *common.WorkspaceCluster) error {
	log.Log.Infof("installing gitpod on cluster %s", cluster.Name)
	err := step.InstallGitpod(context, cluster)
	if err != nil {
		log.Log.Errorf("installation of gitpod on cluster: %s failed: %s", cluster.Name, err)
	} else {
		log.Log.Infof("installation of gitpod on cluster %s succeeded", cluster.Name)
	}
	return err
}

func createCluster(context *common.Context, cluster *common.WorkspaceCluster) error {
	err := step.CreateCluster(context, cluster)
	if err != nil {
		log.Log.Infof("error creating cluster %s: %s", cluster.Name, err)
	}
	return err
}
