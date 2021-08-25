// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/spf13/pflag"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"

	// Import all Kubernetes client auth plugins (e.g. Azure, GCP, OIDC, etc.)
	// to ensure that exec-entrypoint and run can make use of them.
	_ "k8s.io/client-go/plugin/pkg/client/auth"
)

const (
	kubeconfigDefault = "$HOME/.kube/config"
)

var (
	kubeconfig  = pflag.String("kubeconfig", kubeconfigDefault, "Path to the kubeconfig file")
	deployment  = pflag.String("deployment", "", "deployment to copy mounts from")
	destination = pflag.String("destination", "", "destination where to copy the file to")
)

func main() {
	pflag.Parse()
	if *deployment == "" {
		log.Fatal("--deployment is mandatory")
	}
	if *destination == "" {
		log.Fatal("--destination is mandatory")
	}

	err := run()
	if err != nil {
		log.Fatal(err)
	}
}

func run() error {
	var kubecfg string
	if *kubeconfig == kubeconfigDefault {
		home, err := os.UserHomeDir()
		if err != nil {
			return err
		}
		kubecfg = filepath.Join(home, ".kube", "config")
	}

	namespace, _, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubecfg},
		&clientcmd.ConfigOverrides{},
	).Namespace()
	if err != nil {
		return err
	}

	res, err := clientcmd.BuildConfigFromFlags("", kubecfg)
	if err != nil {
		return err
	}
	client, err := kubernetes.NewForConfig(res)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	depl, err := client.AppsV1().Deployments(namespace).Get(ctx, *deployment, metav1.GetOptions{})
	if err != nil {
		return err
	}

	volumes := make(map[string]corev1.Volume)
	for _, v := range depl.Spec.Template.Spec.Volumes {
		volumes[v.Name] = v
	}
	for _, c := range depl.Spec.Template.Spec.Containers {
		for _, cv := range c.VolumeMounts {
			v, ok := volumes[cv.Name]
			if !ok {
				return xerrors.Errorf("did not find volume %s in %s", cv.Name, c.Name)
			}

			err = downloadVolume(ctx, client, namespace, cv, v)
			if err != nil {
				return nil
			}
		}
	}

	return nil
}

func downloadVolume(ctx context.Context, client kubernetes.Interface, namespace string, mount corev1.VolumeMount, volume corev1.Volume) error {
	log.WithField("volume", volume.Name).Info("downloading volume content")
	if volume.ConfigMap != nil {
		return downloadConfigMap(ctx, client, namespace, mount, volume)
	} else if volume.Secret != nil {
		return downloadSecret(ctx, client, namespace, mount, volume)
	} else {
		log.WithField("volume", volume.Name).Warn("unsupported volume type - ignoring")
	}

	return nil
}

func downloadConfigMap(ctx context.Context, client kubernetes.Interface, namespace string, mount corev1.VolumeMount, volume corev1.Volume) (err error) {
	defer func() {
		if err != nil {
			err = xerrors.Errorf("cannot download config map %s", volume.Name)
		}
	}()

	cfgmap, err := client.CoreV1().ConfigMaps(namespace).Get(ctx, volume.ConfigMap.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	dst := filepath.Join(*destination, mount.MountPath)
	for fn, content := range cfgmap.Data {
		dfn := filepath.Join(dst, fn)
		err := os.MkdirAll(filepath.Dir(dfn), 0755)
		if err != nil {
			return err
		}
		err = ioutil.WriteFile(dfn, []byte(content), 0644)
		if err != nil {
			return err
		}
	}

	return nil
}

func downloadSecret(ctx context.Context, client kubernetes.Interface, namespace string, mount corev1.VolumeMount, volume corev1.Volume) (err error) {
	defer func() {
		if err != nil {
			err = xerrors.Errorf("cannot download config map %s", volume.Name)
		}
	}()

	cfgmap, err := client.CoreV1().Secrets(namespace).Get(ctx, volume.Secret.SecretName, metav1.GetOptions{})
	if err != nil {
		return err
	}

	dst := filepath.Join(*destination, mount.MountPath)
	for fn, content := range cfgmap.Data {
		dfn := filepath.Join(dst, fn)
		err := os.MkdirAll(filepath.Dir(dfn), 0755)
		if err != nil {
			return err
		}
		err = ioutil.WriteFile(dfn, []byte(content), 0644)
		if err != nil {
			return err
		}
	}

	return nil
}
