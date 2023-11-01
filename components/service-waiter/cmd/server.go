// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/gitpod-io/gitpod/common-go/log"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "waits for deployment server to become latest build of current installer build",
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
			name:           "server",
			deploymentName: "server",
			containerName:  "server",
			targetImage:    image,
		})

		if err != nil {
			logger.WithError(err).Fatal("failed to wait service")
		} else {
			logger.Info("service is ready")
		}
	},
}

type deploymentWaiterConfig struct {
	name           string
	namespace      string
	deploymentName string
	containerName  string
	targetImage    string
}

func checkK8SDeploymentImage(ctx context.Context, k8sClient *kubernetes.Clientset, cfg *deploymentWaiterConfig) (bool, error) {
	deployment, err := k8sClient.AppsV1().Deployments(cfg.namespace).Get(ctx, cfg.deploymentName, metav1.GetOptions{})
	if err != nil {
		return false, fmt.Errorf("cannot get deployment info: %w", err)
	}
	for _, container := range deployment.Spec.Template.Spec.Containers {
		if container.Name == cfg.containerName {
			if container.Image != cfg.targetImage {
				return false, fmt.Errorf("image is not the same: %s != %s", container.Image, cfg.targetImage)
			}
			if deployment.Status.ReadyReplicas != *deployment.Spec.Replicas {
				return false, fmt.Errorf("not all pods are ready %d/%d", deployment.Status.ReadyReplicas, *deployment.Spec.Replicas)
			}
			return true, nil
		}
	}
	return false, fmt.Errorf("container %s not found", cfg.containerName)
}

func waitK8SDeploymentImage(ctx context.Context, logger *logrus.Entry, cfg *deploymentWaiterConfig) error {
	k8sCfg, err := rest.InClusterConfig()
	if err != nil {
		return fmt.Errorf("cannot get in cluster config: %w", err)
	}
	k8sClient, err := kubernetes.NewForConfig(k8sCfg)
	if err != nil {
		return fmt.Errorf("cannot create k8s client: %w", err)
	}
	ok := false
	for {
		select {
		case <-ctx.Done():
			if ok {
				return nil
			}
			return ctx.Err()
		default:
			ok, err := checkK8SDeploymentImage(ctx, k8sClient, cfg)
			if err != nil {
				logger.WithError(err).WithField("component", cfg.name).Error("image check failed")
				continue
			}
			if ok {
				return nil
			}
			time.Sleep(time.Second)
		}
	}
}

func init() {
	rootCmd.AddCommand(serverCmd)
	serverCmd.Flags().String("image", "", "The latest image of current installer build")
}
