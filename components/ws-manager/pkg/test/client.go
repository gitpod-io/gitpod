// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// GetIntegrationTestClient provides a kubernetes client for integration tests
func GetIntegrationTestClient(kubecfgfn string) (client kubernetes.Interface, namespace string, err error) {
	var kubeconfig string
	switch kubecfgfn {
	case "disabled":
		return
	case "local":
		var home string
		home, err = os.UserHomeDir()
		if err != nil {
			err = xerrors.Errorf("cannot determine user home dir: %w", err)
			return
		}
		kubeconfig = filepath.Join(home, ".kube", "config")
	default:
		kubeconfig = kubecfgfn
	}

	cfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfig},
		&clientcmd.ConfigOverrides{},
	)
	namespace, _, err = cfg.Namespace()
	if err != nil {
		err = xerrors.Errorf("cannot get namespace from kubeconfig: %w", err)
		return
	}

	res, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		err = xerrors.Errorf("cannot build kubeconfig: %w", err)
		return
	}

	client = kubernetes.NewForConfigOrDie(res)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ps, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: "component=ws-manager"})
	if err != nil {
		log.WithError(err).Warn("cannot ensure there's no ws-manager running - test may fail inexplicably")
	}
	if len(ps.Items) > 0 {
		err = xerrors.Errorf("there's a ws-manager running in the namespace %s - this would break the tests. Please scale down that ws-manager prior to running the test (kubectl scale --replicas=0 --namespace=%s deployment/ws-manager)", namespace, namespace)
		return
	}

	_ = client.CoreV1().Pods(namespace).DeleteCollection(ctx, *metav1.NewDeleteOptions(30), metav1.ListOptions{LabelSelector: "component=workspace"})
	_ = client.CoreV1().ConfigMaps(namespace).DeleteCollection(ctx, *metav1.NewDeleteOptions(30), metav1.ListOptions{LabelSelector: "component=workspace"})

	return
}
