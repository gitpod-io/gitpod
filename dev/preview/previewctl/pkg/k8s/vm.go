// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k8s

import (
	"context"
	"time"

	"github.com/cockroachdb/errors"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
	virtv1 "kubevirt.io/api/core/v1"
)

var (
	vmResource = schema.GroupVersionResource{
		Group:    "kubevirt.io",
		Version:  "v1",
		Resource: "virtualmachines",
	}

	vmInstanceResource = schema.GroupVersionResource{
		Group:    "kubevirt.io",
		Version:  "v1",
		Resource: "virtualmachineinstances",
	}

	ErrGettingVMIpAddress       = errors.New("error parsing vm ip address")
	ErrVMInterfacesLengthIsZero = errors.New("vm interfaces length is 0")
	ErrVMNoDefaultIPAddrFound   = errors.New("vm no default ip addr found")
	ErrVmNotReady               = errors.New("vm not ready")
)

func getVMInstanceIPAddress(vm virtv1.VirtualMachineInstance) (string, error) {
	if len(vm.Status.Interfaces) == 0 {
		return "", ErrVMInterfacesLengthIsZero
	}

	for _, i := range vm.Status.Interfaces {
		if i.Name == "default" {
			return i.IP, nil
		}
	}

	return "", ErrVMNoDefaultIPAddrFound
}

func parseVMInstanceIPAddress(obj *unstructured.Unstructured) (string, error) {
	var vmi virtv1.VirtualMachineInstance
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.UnstructuredContent(), &vmi)
	if err != nil {
		return "", errors.Wrap(err, ErrGettingVMIpAddress.Error())
	}

	return getVMInstanceIPAddress(vmi)
}

func (c *Config) GetVMStatus(ctx context.Context, name, namespace string) error {
	vmi, err := c.getVMI(ctx, name, namespace)
	if err != nil {
		return err
	}

	ip, err := getVMInstanceIPAddress(*vmi)
	if err != nil {
		return errors.Wrap(ErrVmNotReady, err.Error())
	}

	if ip == "" {
		return ErrVmNotReady
	}

	return nil
}

func (c *Config) GetVMICreationTimestamp(ctx context.Context, name, namespace string) (*metav1.Time, error) {
	vmi, err := c.getVMI(ctx, name, namespace)

	if err != nil {
		return nil, err
	}

	return &vmi.ObjectMeta.CreationTimestamp, nil
}

func (c *Config) WaitVMReady(ctx context.Context, name, namespace string, doneCh chan struct{}) error {
	kubeInformerFactory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(c.DynamicClient, time.Second*30, namespace, nil)
	vmInformer := kubeInformerFactory.ForResource(vmInstanceResource).Informer()

	vmInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			res := obj.(*unstructured.Unstructured)
			ip, err := parseVMInstanceIPAddress(res)
			if err != nil && errors.Is(err, ErrGettingVMIpAddress) {
				c.logger.Warnf("error parsing VM IP Addr: %v", err)
				return
			}

			if ip == "" {
				return
			}

			doneCh <- struct{}{}
		},
		// We also watch for updates
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			res := newObj.(*unstructured.Unstructured)
			ip, err := parseVMInstanceIPAddress(res)
			if err != nil && errors.Is(err, ErrGettingVMIpAddress) {
				c.logger.Warnf("error parsing VM IP Addr: %v", err)
				return
			}

			if ip == "" {
				return
			}

			doneCh <- struct{}{}
		},
	})

	stopCh := make(chan struct{})
	defer close(stopCh)

	kubeInformerFactory.Start(stopCh)
	kubeInformerFactory.WaitForCacheSync(wait.NeverStop)

	for {
		select {
		case <-doneCh:
			c.logger.Infof("[%s] vm ready", name)
			return nil
		case <-ctx.Done():
			return ctx.Err()
		case <-stopCh:
			return errors.New("received stop signal")
		case <-time.Tick(5 * time.Second):
			c.logger.Infof("waiting for vm [%s] to get ready", name)
		}
	}
}

func (c *Config) GetVMs(ctx context.Context) ([]string, error) {
	virtualMachineClient := c.DynamicClient.Resource(vmResource).Namespace("")
	vmObjs, err := virtualMachineClient.List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var vms []string
	for _, item := range vmObjs.Items {
		vms = append(vms, item.GetName())
	}

	return vms, nil
}

func (c *Config) getVMI(ctx context.Context, name, namespace string) (*virtv1.VirtualMachineInstance, error) {
	_, err := c.CoreClient.CoreV1().Namespaces().Get(ctx, namespace, metav1.GetOptions{})
	if err != nil && !kerrors.IsNotFound(err) {
		return nil, errors.Wrap(ErrVmNotReady, err.Error())
	}

	if kerrors.IsNotFound(err) {
		c.logger.Infof("namespace [%s] not found", namespace)
		return nil, errors.Wrap(ErrVmNotReady, err.Error())
	}

	vmClient := c.DynamicClient.Resource(vmInstanceResource).Namespace(namespace)
	res, err := vmClient.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, errors.Wrap(ErrVmNotReady, err.Error())
	}

	var vmi virtv1.VirtualMachineInstance
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(res.UnstructuredContent(), &vmi)
	if err != nil {
		return nil, errors.Wrap(ErrVmNotReady, err.Error())
	}

	return &vmi, nil
}
