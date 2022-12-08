// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rabbitmq

import (
	_ "embed"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

//go:embed certs/msgbus-ca.pem
var caPem []byte

//go:embed certs/msgbus-client.crt
var clientCert []byte

//go:embed certs/msgbus-client.pem
var clientPem []byte

func secrets(ctx *common.RenderContext) ([]runtime.Object, error) {
	cookieString := "ZX3m37WDZvdH8zy03ZVZ"

	return []runtime.Object{&corev1.Secret{
		TypeMeta: common.TypeMetaSecret,
		ObjectMeta: metav1.ObjectMeta{
			Name:      CookieSecret,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Data: map[string][]byte{
			"rabbitmq-erlang-cookie": []byte(cookieString),
		},
	}, &corev1.Secret{
		TypeMeta: common.TypeMetaSecret,
		ObjectMeta: metav1.ObjectMeta{
			Name:      TLSSecret,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Data: map[string][]byte{
			"ca.crt":  caPem,
			"tls.crt": clientCert,
			"tls.key": clientPem,
		},
	}}, nil
}
