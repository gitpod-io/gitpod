// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/gitpod-io/gitpod/common-go/experiments"
	k8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/service-waiter/pkg/metrics"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var componentCmdOpt struct {
	image          string
	namespace      string
	component      string
	labels         string
	ideMetricsHost string
	gitpodHost     string

	featureFlagTimeout time.Duration
}

var componentCmd = &cobra.Command{
	Use:   "component",
	Short: "waits for component to become latest build of current installer build",
	PreRun: func(cmd *cobra.Command, args []string) {
		err := viper.BindPFlags(cmd.Flags())
		if err != nil {
			log.WithError(err).Fatal("cannot bind Viper to pflags")
		}
	},
	Run: func(cmd *cobra.Command, args []string) {
		if componentCmdOpt.image == "" {
			log.Errorf("target image is empty, skip service waiter %s", componentCmdOpt.component)
			return
		}
		timeout := getTimeout()
		log.WithField("timeout", timeout.String()).WithFields(logrus.Fields{"image": componentCmdOpt.image, "component": componentCmdOpt.component, "namespace": componentCmdOpt.namespace, "labels": componentCmdOpt.labels}).Info("start to wait component")
		ctx, cancel := context.WithTimeout(cmd.Context(), timeout)
		defer cancel()

		go startWaitFeatureFlag(ctx, componentCmdOpt.featureFlagTimeout)

		err := waitPodsImage(ctx)

		if err != nil {
			log.WithError(err).Fatal("failed to wait service")
		} else {
			log.Info("service is ready")
		}
	},
}

var shouldSkipComponentWaiter bool = false

func checkPodsImage(ctx context.Context, k8sClient *kubernetes.Clientset) (bool, error) {
	pods, err := k8sClient.CoreV1().Pods(componentCmdOpt.namespace).List(ctx, metav1.ListOptions{
		LabelSelector: componentCmdOpt.labels,
	})
	if err != nil {
		return false, fmt.Errorf("cannot get pod list: %w", err)
	}
	if len(pods.Items) == 0 {
		return false, fmt.Errorf("no pods found")
	}
	readyCount := 0
	for _, pod := range pods.Items {
		if pod.Annotations[k8s.ImageNameAnnotation] != componentCmdOpt.image {
			return false, fmt.Errorf("image is not the same: %s != %s", pod.Annotations[k8s.ImageNameAnnotation], componentCmdOpt.image)
		}
		for _, condition := range pod.Status.Conditions {
			if condition.Type == corev1.PodReady {
				if condition.Status == corev1.ConditionTrue {
					readyCount += 1
				} else {
					return false, fmt.Errorf("pod is not ready")
				}
			}
		}
	}
	log.Infof("ready pods: %d/%d", readyCount, len(pods.Items))
	return readyCount == len(pods.Items), nil
}

func waitPodsImage(ctx context.Context) error {
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
			if shouldSkipComponentWaiter {
				log.Infof("skip component waiter %s with Feature Flag", componentCmdOpt.component)
				return nil
			}
			ok, err := checkPodsImage(ctx, k8sClient)
			if err != nil {
				log.WithError(err).Error("image check failed")
				time.Sleep(1 * time.Second)
				continue
			}
			if ok {
				return nil
			}
			time.Sleep(1 * time.Second)
		}
	}
}

func init() {
	rootCmd.AddCommand(componentCmd)
	componentCmd.Flags().StringVar(&componentCmdOpt.image, "image", "", "The latest image of current installer build")
	componentCmd.Flags().StringVar(&componentCmdOpt.namespace, "namespace", "", "The namespace of deployment")
	componentCmd.Flags().StringVar(&componentCmdOpt.component, "component", "", "Component name of deployment")
	componentCmd.Flags().StringVar(&componentCmdOpt.labels, "labels", "", "Labels of deployment")
	componentCmd.Flags().StringVar(&componentCmdOpt.ideMetricsHost, "ide-metrics-host", "", "Host of ide metrics")
	componentCmd.Flags().DurationVar(&componentCmdOpt.featureFlagTimeout, "feature-flag-timeout", 3*time.Minute, "The maximum time to wait for feature flag")
	componentCmd.Flags().StringVar(&componentCmdOpt.gitpodHost, "gitpod-host", "", "Domain of Gitpod installation")

	_ = componentCmd.MarkFlagRequired("namespace")
	_ = componentCmd.MarkFlagRequired("component")
	_ = componentCmd.MarkFlagRequired("labels")
}

func startWaitFeatureFlag(ctx context.Context, timeout time.Duration) {
	featureFlagCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	client := experiments.NewClient(experiments.WithDefaultClient(nil), experiments.WithPollInterval(time.Second*3))
	defaultSkip := true
	if client == nil {
		log.Error("failed to create experiments client, skip immediately")
		shouldSkipComponentWaiter = defaultSkip
		metrics.AddSkipComponentsCounter(componentCmdOpt.ideMetricsHost, strconv.FormatBool(shouldSkipComponentWaiter), false)
		return
	}
	getShouldSkipComponentWaiter := func() {
		startTime := time.Now()
		value, isActualValue, fetchTimes := ActualWaitFeatureFlag(featureFlagCtx, client, defaultSkip)
		avgTime := time.Duration(0)
		if fetchTimes > 0 {
			avgTime = time.Since(startTime) / time.Duration(fetchTimes)
		}
		log.WithField("fetchTimes", fetchTimes).WithField("avgTime", avgTime).WithField("isActualValue", isActualValue).WithField("value", value).Info("get final value of feature flag")
		shouldSkipComponentWaiter = value
		metrics.AddSkipComponentsCounter(componentCmdOpt.ideMetricsHost, strconv.FormatBool(shouldSkipComponentWaiter), isActualValue)
	}
	for !shouldSkipComponentWaiter {
		if featureFlagCtx.Err() != nil {
			break
		}
		getShouldSkipComponentWaiter()
		time.Sleep(1 * time.Second)
	}
}

var FeatureSleepDuration = 1 * time.Second

func ActualWaitFeatureFlag(ctx context.Context, client experiments.Client, defaultValue bool) (flagValue bool, ok bool, fetchTimes int) {
	if client == nil {
		return defaultValue, false, fetchTimes
	}
	for {
		select {
		case <-ctx.Done():
			log.WithField("defaultValue", defaultValue).Info("feature flag timeout with no expected value, fallback")
			return defaultValue, false, fetchTimes
		default:
			stringValue := client.GetStringValue(ctx, experiments.ServiceWaiterSkipComponentsFlag, "NONE", experiments.Attributes{
				GitpodHost: componentCmdOpt.gitpodHost,
				Component:  componentCmdOpt.component,
			})
			fetchTimes++
			if stringValue == "true" {
				return true, true, fetchTimes
			}
			if stringValue == "false" {
				return false, true, fetchTimes
			}
			if stringValue == "NONE" {
				time.Sleep(FeatureSleepDuration)
				continue
			}
			log.WithField("value", stringValue).Warn("unexpected value from feature flag")
			time.Sleep(FeatureSleepDuration)
		}
	}
}
