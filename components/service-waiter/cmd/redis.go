// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"net"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var redisCmd = &cobra.Command{
	Use:   "redis",
	Short: "waits for redis to become reachable",
	PreRun: func(cmd *cobra.Command, args []string) {
		err := viper.BindPFlags(cmd.Flags())
		if err != nil {
			log.WithError(err).Fatal("cannot bind Viper to pflags")
		}
	},
	Run: func(cmd *cobra.Command, args []string) {
		host := viper.GetString("host")
		port := viper.GetString("port")

		timeout := getTimeout()
		done := make(chan bool)
		logger := log.WithField("timeout", timeout.String()).WithField("host", host).WithField("port", port)
		go func() {
			logger.Info("Attempting to connect to redis")
			for {
				redisClient := redis.NewClient(&redis.Options{
					Addr: net.JoinHostPort(host, port),
				})
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()

				err := redisClient.Ping(ctx).Err()
				if err == nil {
					break
				}

				logger.WithError(err).Error("Failed to ping redis, retrying...")
				<-time.After(time.Second)
			}

			close(done)
		}()

		select {
		case <-done:
			logger.Info("Redis became reachable")
			return
		case <-time.After(timeout):
			logger.Fatal("Redis did not become available in time")
		}
	},
}

func init() {
	rootCmd.AddCommand(redisCmd)

	redisCmd.Flags().StringP("host", "H", "redis", "Host to try and connect to")
	redisCmd.Flags().StringP("port", "p", "6379", "Port to connect on")
}
