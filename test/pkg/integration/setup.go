// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"flag"
	"fmt"
	"os"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"
	"sigs.k8s.io/e2e-framework/klient"
	"sigs.k8s.io/e2e-framework/pkg/env"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/flags"
)

func SkipWithoutUsername(t *testing.T, username string) {
	if username == "" {
		t.Skip("Skipping because requires a username")
	}
}
func Setup(ctx context.Context) (string, string, env.Environment) {
	var (
		username        string
		waitGitpodReady time.Duration

		namespace  string
		kubeconfig string
		feature    string
		assess     string

		labels = make(flags.LabelsMap)
	)

	flagset := flag.CommandLine
	klog.InitFlags(flagset)

	flagset.StringVar(&username, "username", "", "username to execute the tests with. Chooses one automatically if left blank.")
	flagset.DurationVar(&waitGitpodReady, "wait-gitpod-timeout", 5*time.Minute, `wait time for Gitpod components before starting integration test`)
	flagset.StringVar(&namespace, "namespace", "", "Kubernetes cluster namespaces to use")
	flagset.StringVar(&kubeconfig, "kubeconfig", "", "The path to the kubeconfig file")
	flagset.StringVar(&feature, "feature", "", "Regular expression that targets features to test")
	flagset.StringVar(&assess, "assess", "", "Regular expression that targets assertive steps to run")
	flagset.Var(&labels, "labels", "Comma-separated key/value pairs to filter tests by labels")
	if err := flagset.Parse(os.Args[1:]); err != nil {
		klog.Fatalf("cannot parse flags: %v", err)
	}

	e := envconf.New()
	if assess != "" {
		e.WithAssessmentRegex(assess)
	}
	if feature != "" {
		e.WithFeatureRegex(feature)
	}

	client, err := klient.NewWithKubeConfigFile(kubeconfig)
	if err != nil {
		klog.Fatalf("unexpected error: %v", err)
	}

	e.WithClient(client)
	e.WithLabels(labels)
	e.WithNamespace(namespace)

	// use the namespace from the CurrentContext
	if namespace == "" {
		ns, err := getNamespace(kubeconfig)
		if err != nil {
			klog.Fatalf("unexpected error obtaining context namespace: %v", err)
		}
		e.WithNamespace(ns)
	}

	testenv, err := env.NewWithContext(ctx, e)
	if err != nil {
		klog.Fatalf("unexpected error: %v", err)
	}
	testenv.Setup(
		waitOnGitpodRunning(e.Namespace(), waitGitpodReady),
	)

	return username, e.Namespace(), testenv
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

func getNamespace(path string) (string, error) {
	var cfg clientcmd.ClientConfig

	switch path {
	case "":
		loadingrules := clientcmd.NewDefaultClientConfigLoadingRules()
		cfg = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingrules,
			&clientcmd.ConfigOverrides{})
	default:
		cfg = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
			&clientcmd.ClientConfigLoadingRules{ExplicitPath: path},
			&clientcmd.ConfigOverrides{})
	}

	namespace, _, err := cfg.Namespace()
	if err != nil {
		return "", err
	}

	return namespace, nil
}
