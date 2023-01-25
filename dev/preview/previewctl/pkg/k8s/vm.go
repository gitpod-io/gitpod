// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package k8s

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	vmResource = schema.GroupVersionResource{
		Group:    "kubevirt.io",
		Version:  "v1",
		Resource: "virtualmachines",
	}
)

func (c *Config) GetSVCCreationTimestamp(ctx context.Context, name, namespace string) (*metav1.Time, error) {
	svc, err := c.CoreClient.CoreV1().Services(namespace).Get(ctx, "proxy", metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	return &svc.ObjectMeta.CreationTimestamp, nil
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
