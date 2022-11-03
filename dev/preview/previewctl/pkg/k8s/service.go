// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k8s

import (
	"context"
	"time"

	"github.com/cockroachdb/errors"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/tools/cache"
)

var ErrSvcNotReady = errors.New("proxy service not ready")

const proxySvcName = "proxy"

func (c *Config) GetProxyVMServiceStatus(ctx context.Context, namespace string) error {
	_, err := c.CoreClient.CoreV1().Namespaces().Get(ctx, namespace, metav1.GetOptions{})
	if err != nil {
		return errors.Wrap(ErrSvcNotReady, err.Error())
	}

	svc, err := c.CoreClient.CoreV1().Services(namespace).Get(ctx, proxySvcName, metav1.GetOptions{})
	if err != nil {
		return errors.Wrap(ErrSvcNotReady, err.Error())
	}

	if svc.Spec.ClusterIP == "" {
		return ErrSvcNotReady
	}

	return nil
}

func (c *Config) WaitProxySvcReady(ctx context.Context, namespace string, doneCh chan struct{}) error {
	kubeInformerFactory := informers.NewSharedInformerFactoryWithOptions(c.CoreClient, time.Second*30, informers.WithNamespace(namespace))
	svcInformer := kubeInformerFactory.Core().V1().Services().Informer()

	stopCh := make(chan struct{})
	defer close(stopCh)

	svcInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			svc := obj.(*v1.Service)
			if svc.Namespace == namespace && svc.Name == proxySvcName {
				doneCh <- struct{}{}
			}
		},
	})

	kubeInformerFactory.Start(stopCh)
	kubeInformerFactory.WaitForCacheSync(wait.NeverStop)

	for {
		select {
		case <-doneCh:
			c.logger.Infof("service [%s] created", proxySvcName)
			return nil
		case <-ctx.Done():
			return ctx.Err()
		case <-stopCh:
			return errors.New("received stop signal")
		case <-time.Tick(5 * time.Second):
			c.logger.Infof("waiting for svc [%s] to get created", proxySvcName)
		}
	}
}
