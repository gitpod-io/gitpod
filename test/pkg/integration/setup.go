// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"flag"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"
	"sigs.k8s.io/e2e-framework/klient"
	"sigs.k8s.io/e2e-framework/klient/conf"
	"sigs.k8s.io/e2e-framework/pkg/env"
	"sigs.k8s.io/e2e-framework/pkg/envconf"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
)

func Setup(ctx context.Context) (string, string, env.Environment) {
	var (
		kubeconfig      = flag.String("kubeconfig", "", "path to the kubeconfig file or empty to use of in cluster Kubernetes config")
		namespace       = flag.String("namespace", "", `namespace to execute the test against. Defaults to the one configured in "kubeconfig".`)
		username        = flag.String("username", "", "username to execute the tests with. Chooses one automatically if left blank.")
		waitGitpodReady = flag.Duration("wait-gitpod-timeout", 5*time.Minute, `wait time for Gitpod components before starting integration test`)
	)

	klog.InitFlags(nil)
	flag.Parse()

	var kubecfg string
	if *kubeconfig != "" {
		kubecfg = *kubeconfig
	} else {
		kubecfg = conf.ResolveKubeConfigFile()
	}

	restConfig, ns, err := getKubeconfig(kubecfg)
	if err != nil {
		klog.Fatalf("unexpected error: %v", err)
	}

	// use the namespace from the CurrentContext
	if *namespace == "" {
		*namespace = ns
	}

	// change defaults to avoid limiting connections
	restConfig.QPS = 20
	restConfig.Burst = 50

	client, err := klient.New(restConfig)
	if err != nil {
		klog.Fatalf("unexpected error: %v", err)
	}

	conf, err := envconf.NewFromFlags()
	if err != nil {
		klog.Fatalf("cannot create test environment: %v", err)
	}

	conf.WithClient(client)
	conf.WithNamespace(*namespace)

	ctx = context.WithValue(ctx, "username", *username)

	testenv, err := env.NewWithContext(ctx, conf)
	if err != nil {
		klog.Fatalf("unexpected error: %v", err)
	}
	testenv.Setup(
		waitOnGitpodRunning(*namespace, *waitGitpodReady),
	)

	return *username, *namespace, testenv
}

func waitOnGitpodRunning(namespace string, waitTimeout time.Duration) env.Func {
	klog.V(2).Info("Checking status of Gitpod components...")

	return func(ctx context.Context, cfg *envconf.Config) (context.Context, error) {
		components := []string{
			"agent-smith",
			"blobserve",
			"content-service",
			"dashboard",
			"image-builder-mk3",
			"proxy",
			"registry-facade",
			"server",
			"ws-daemon",
			"ws-manager",
			"ws-manager-bridge",
			"ws-proxy",
			"ws-scheduler",
		}

		client := cfg.Client()
		err := wait.PollImmediate(5*time.Second, waitTimeout, func() (bool, error) {
			for _, component := range components {
				var pods corev1.PodList
				err := client.Resources(namespace).List(context.Background(), &pods, func(opts *metav1.ListOptions) {
					opts.LabelSelector = fmt.Sprintf("component=%v", component)
				})
				if err != nil {
					klog.Errorf("unexpected error searching Gitpod components: %v", err)
					return false, nil
				}

				if len(pods.Items) == 0 {
					klog.Warningf("no pod ready for component %v", component)
					return false, nil
				}

				for _, p := range pods.Items {
					var isReady bool
					for _, cond := range p.Status.Conditions {
						if cond.Type == corev1.PodReady {
							isReady = cond.Status == corev1.ConditionTrue
							break
						}
					}
					if !isReady {
						klog.Warningf("no pod ready for component %v", component)
						return false, nil
					}
				}
			}

			klog.V(2).Info("All Gitpod components are running...")
			return true, nil
		})
		if err != nil {
			return ctx, nil
		}

		return ctx, nil
	}
}

func getKubeconfig(kubeconfig string) (res *rest.Config, namespace string, err error) {
	cfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfig},
		&clientcmd.ConfigOverrides{},
	)
	namespace, _, err = cfg.Namespace()
	if err != nil {
		return nil, "", err
	}

	res, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, "", err
	}
	res.RateLimiter = &wsk8s.UnlimitedRateLimiter{}

	return res, namespace, nil
}
