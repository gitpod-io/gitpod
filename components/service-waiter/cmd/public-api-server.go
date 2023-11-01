// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var publicApiServerCmd = &cobra.Command{
	Use:   "public-api-server",
	Short: "waits for deployment public-api-server to become latest build of current installer build",
	PreRun: func(cmd *cobra.Command, args []string) {
		err := viper.BindPFlags(cmd.Flags())
		if err != nil {
			log.WithError(err).Fatal("cannot bind Viper to pflags")
		}
	},
	Run: func(cmd *cobra.Command, args []string) {
		image := viper.GetString("image")
		timeout := getTimeout()
		logger := log.WithField("timeout", timeout.String()).WithField("image", image)
		if image == "" {
			logger.Fatal("Target image should be defined")
		}
		ctx, cancel := context.WithTimeout(cmd.Context(), timeout)
		defer cancel()

		err := waitK8SDeploymentImage(ctx, logger, &deploymentWaiterConfig{
			// TODO: make sure there's only one source for those vars in installer and service-waiter
			namespace:      "default",
			name:           "public-api-server",
			deploymentName: "public-api-server",
			containerName:  "public-api-server",
			targetImage:    image,
		})

		if err != nil {
			logger.WithError(err).Fatal("failed to wait service")
		} else {
			logger.Info("service is ready")
		}
	},
}

func init() {
	rootCmd.AddCommand(publicApiServerCmd)
	publicApiServerCmd.Flags().String("image", "", "The latest image of current installer build")
}
