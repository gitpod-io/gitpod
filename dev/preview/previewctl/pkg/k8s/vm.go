// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package k8s

import (
	"context"
	"github.com/cockroachdb/errors"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

	ErrVmNotReady = errors.New("vm not ready")
)

func (c *Config) GetVMICreationTimestamp(ctx context.Context, name, namespace string) (*metav1.Time, error) {
	vmi, err := c.getVMI(ctx, name, namespace)

	if err != nil {
		return nil, err
	}

	return &vmi.ObjectMeta.CreationTimestamp, nil
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
