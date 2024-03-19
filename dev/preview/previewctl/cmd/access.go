// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

func newHasAccessCmd(logger *logrus.Logger) *cobra.Command {
	clusters := []string{}
	cmd := &cobra.Command{
		Use:   "has-access",
		Short: "Check if caller has access to the provided list of clusters",
		RunE: func(cmd *cobra.Command, args []string) error {
			for _, kc := range clusters {
				if !hasAccess(context.Background(), logger, kc) {
					return errors.Newf("no access to [%v]", kc)
				}
			}

			logger.Infof("Has access to %v", clusters)
			return nil
		},
	}

	cmd.PersistentFlags().StringSliceVar(&clusters, "clusters", []string{"dev"}, "Comma separated list of cluster to check access for")

	return cmd
}
