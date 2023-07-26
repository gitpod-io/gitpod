// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"testing"
	"text/tabwriter"
	"time"

	corev1 "k8s.io/api/core/v1"
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

func SkipWithoutUserToken(t *testing.T, userToken string) {
	if userToken == "" {
		t.Skip("Skipping because requires a user token")
	}
}

func SkipWithoutEnterpriseLicense(t *testing.T, enterpise bool) {
	if !enterpise {
		t.Skip("Skipping because requires enterprise license")
	}
}

func EnsureUserExists(t *testing.T, username string, api *ComponentAPI) string {
	if username == "" {
		t.Logf("no username provided, creating temporary one")
		rand.Seed(time.Now().UnixNano())
		randN := rand.Intn(1000)
		newUser := fmt.Sprintf("johndoe%d", randN)
		userId, err := CreateUser(newUser, false, api)
		if err != nil {
			t.Fatalf("cannot create user: %q", err)
		}
		t.Cleanup(func() {
			err := DeleteUser(userId, api)
			if err != nil {
				t.Fatalf("error deleting user %q", err)
			}
		})
		t.Logf("user '%s' with ID %s created", newUser, userId)
		return newUser
	}
	return username
}

func Setup(ctx context.Context) (string, string, env.Environment, bool, string, bool) {
	var (
		username        string
		enterprise      bool
		gitlab          bool
		waitGitpodReady time.Duration

		namespace  string
		kubeconfig string
		feature    string
		assess     string
		parallel   bool

		labels = make(flags.LabelsMap)
	)

	flagset := flag.CommandLine
	klog.InitFlags(flagset)

	defaultKubeConfig := os.Getenv("KUBE_CONFIG")
	if defaultKubeConfig == "" {
		defaultKubeConfig = "/home/gitpod/.kube/config"
	}
	flagset.StringVar(&username, "username", os.Getenv("USER_NAME"), "username to execute the tests with. Chooses one automatically if left blank.")
	flagset.BoolVar(&enterprise, "enterprise", false, "whether to test enterprise features. requires enterprise lisence installed.")
	flagset.BoolVar(&gitlab, "gitlab", false, "whether to test gitlab integration.")
	flagset.BoolVar(&parallel, "parallel-features", false, "Run test features in parallel")
	flagset.DurationVar(&waitGitpodReady, "wait-gitpod-timeout", 5*time.Minute, `wait time for Gitpod components before starting integration test`)
	flagset.StringVar(&namespace, "namespace", "", "Kubernetes cluster namespaces to use")
	flagset.StringVar(&kubeconfig, "kubeconfig", defaultKubeConfig, "The path to the kubeconfig file")
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
	if parallel {
		e.WithParallelTestEnabled()
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

	return username, e.Namespace(), testenv, enterprise, kubeconfig, gitlab
}

type component struct {
	name     string
	labelKey string
}

func (c component) Matches(pod corev1.Pod) bool {
	key := "component"
	if c.labelKey != "" {
		key = c.labelKey
	}
	return pod.Labels[key] == c.name
}

var (
	components = []component{
		{name: "agent-smith"},
		{name: "blobserve"},
		{name: "content-service"},
		{name: "dashboard"},
		{name: "ide-proxy"},
		{name: "ide-service"},
		{name: "image-builder-mk3"},
		{name: "minio", labelKey: "app.kubernetes.io/name"},
		{name: "mysql", labelKey: "app.kubernetes.io/name"},
		{name: "node-labeler"},
		{name: "proxy"},
		{name: "public-api-server"},
		{name: "redis"},
		{name: "registry-facade"},
		{name: "server"},
		{name: "spicedb"},
		{name: "usage"},
		{name: "ws-daemon"},
		{name: "ws-manager-mk2"},
		{name: "ws-manager-bridge"},
		{name: "ws-proxy"},
	}
)

func waitOnGitpodRunning(namespace string, waitTimeout time.Duration) env.Func {
	klog.V(2).Info("Checking status of Gitpod components...")
	return func(ctx context.Context, cfg *envconf.Config) (context.Context, error) {
		client := cfg.Client()
		err := wait.PollImmediate(1*time.Second, waitTimeout, func() (bool, error) {
			ready, reason, err := isPreviewReady(client, namespace)
			if err != nil {
				klog.Errorf("error checking if preview is ready: %v", err)
				return false, nil
			}
			if !ready {
				klog.Warningf("preview is not (yet) ready: %s", reason)
				return false, nil
			}

			klog.V(2).Info("All Gitpod components are running...")
			return true, nil
		})
		if err != nil {
			return ctx, err
		}

		return ctx, nil
	}
}

func logGitpodStatus(t *testing.T, client klient.Client, namespace string) {
	var allPods corev1.PodList
	err := client.Resources(namespace).List(context.Background(), &allPods)
	if err != nil {
		t.Logf("failed to list pods to log gitpod status: %v", err)
		return
	}

	var buf strings.Builder
	tw := tabwriter.NewWriter(&buf, 0, 0, 1, ' ', 0)
	_, _ = tw.Write([]byte("Component\tPod\tReady\tStatus\tRestarts\tAge\n"))

	for _, component := range components {
		var pods []corev1.Pod
		for _, pod := range allPods.Items {
			if component.Matches(pod) {
				pods = append(pods, pod)
			}
		}
		for _, p := range pods {
			var restarts int
			var ready int
			for _, c := range p.Status.ContainerStatuses {
				restarts += int(c.RestartCount)
				if c.Ready {
					ready += 1
				}
			}
			var age *time.Duration
			if p.Status.StartTime != nil {
				s := time.Since(p.Status.StartTime.Time).Round(time.Second)
				age = &s
			}
			_, _ = tw.Write([]byte(fmt.Sprintf("%s\t%s\t%d/%d\t%v\t%d\t%v\n", component.name, p.Name, ready, len(p.Status.ContainerStatuses), p.Status.Phase, restarts, age)))
		}
	}
	tw.Flush()
	t.Logf("Gitpod components status:\n" + buf.String())
}

func isPreviewReady(client klient.Client, namespace string) (ready bool, reason string, err error) {
	ready = true
	reasons := make(map[component]string)
	var allPods corev1.PodList
	err = client.Resources(namespace).List(context.Background(), &allPods)
	if err != nil {
		return false, "", fmt.Errorf("failed to list pods: %w", err)
	}
	for _, component := range components {
		compReady, reason := isComponentReady(client, namespace, component, allPods)
		if !compReady {
			klog.Warningf("no pod ready for component %v: %s", component.name, reason)
			ready = false
			reasons[component] = reason
			continue
		}
	}

	if !ready {
		var reasonList []string
		for component, reason := range reasons {
			reasonList = append(reasonList, fmt.Sprintf("%s: %s", component, reason))
		}
		return false, strings.Join(reasonList, ", "), nil
	}

	return true, "", nil
}

func isComponentReady(client klient.Client, namespace string, component component, allPods corev1.PodList) (ready bool, reason string) {
	var pods []corev1.Pod
	for _, pod := range allPods.Items {
		if component.Matches(pod) {
			pods = append(pods, pod)
		}
	}

	if len(pods) == 0 {
		return false, "no pod found"
	}

	for _, p := range pods {
		var isReady bool
		for _, cond := range p.Status.Conditions {
			if cond.Type == corev1.PodReady {
				isReady = cond.Status == corev1.ConditionTrue
				if !isReady {
					return false, fmt.Sprintf("pod %s is not ready: %v", p.Name, p.Status)
				}
				break
			}
		}
		if !isReady {
			return false, fmt.Sprintf("pod %s has no ready condition: %v", p.Name, p.Status)
		}
	}

	return true, ""
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
