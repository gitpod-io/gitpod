// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k8s

import (
	"context"
	"testing"

	"github.com/cockroachdb/errors"
	"github.com/stretchr/testify/assert"
	v1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestGetVMProxySvcStatus(t *testing.T) {
	c := &Config{
		logger: nil,
	}

	namespace := "preview-test"

	ns := &v1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: namespace,
		},
	}

	testCases := []struct {
		name    string
		objects []runtime.Object
		err     error
	}{
		{
			name: "namespace not found error, nothing exists",
			err:  errors.Wrap(ErrSvcNotReady, kerrors.NewNotFound(v1.Resource("namespaces"), namespace).Error()),
		},
		{
			name:    "service not found error, namespace exists",
			objects: []runtime.Object{ns},
			err:     errors.Wrap(ErrSvcNotReady, kerrors.NewNotFound(v1.Resource("services"), proxySvcName).Error()),
		},
		{
			name: "service not ready error, ns and svc exists",
			objects: []runtime.Object{
				ns,
				&v1.Service{
					ObjectMeta: metav1.ObjectMeta{
						Name:      proxySvcName,
						Namespace: namespace,
					},
					Spec: v1.ServiceSpec{
						ClusterIP: "",
					},
				},
			},
			err: ErrSvcNotReady,
		},
		{
			name: "no error",
			objects: []runtime.Object{
				ns,
				&v1.Service{
					ObjectMeta: metav1.ObjectMeta{
						Name:      proxySvcName,
						Namespace: namespace,
					},
					Spec: v1.ServiceSpec{
						ClusterIP: "127.0.0.1",
					},
				},
			},
			err: nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			c.CoreClient = fake.NewSimpleClientset(test.objects...)

			err := c.GetProxyVMServiceStatus(context.TODO(), namespace)

			if test.err != nil {
				// we have to compare on error value, as otherwise it will always fail since the errors are pointers
				assert.Equal(t, errors.Unwrap(test.err), errors.Unwrap(err))
			} else {
				assert.ErrorIs(t, err, test.err)
			}
		})
	}
}
