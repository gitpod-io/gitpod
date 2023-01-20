// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rabbitmq

import (
	_ "embed"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
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

	return []runtime.Object{
		&corev1.Secret{
			TypeMeta: common.TypeMetaSecret,
			ObjectMeta: metav1.ObjectMeta{
				Name:      CookieSecret,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string][]byte{
				"rabbitmq-erlang-cookie": []byte(cookieString),
			},
		},
		&corev1.Secret{
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
		},
		&corev1.Secret{
			TypeMeta: common.TypeMetaSecret,
			ObjectMeta: metav1.ObjectMeta{
				Name:      InClusterMsgBusSecret,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: func() map[string][]byte {
				data := map[string][]byte{
					"username": []byte(rabbitMQUsername),
				}

				// The password may be set three ways:
				// 1. deprecated experimental config (add to this map)
				// 2. default method here (add to this map)
				// 3. a secret (don't add to this map)
				password := ""

				// @deprecated Pull message bus password from experimental config
				_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
					if cfg.Common != nil {
						password = cfg.Common.StaticMessagebusPassword
					}
					return nil
				})

				if password == "" && (ctx.Config.MessageBus == nil || ctx.Config.MessageBus.Credentials == nil) {
					// If not providing message bus secret, use the default creds
					// This service is not accessible externally, so setting a default password is an acceptable compromise
					password = "uq4KxOLtrA-QsDTfuwQ-"
				}

				if password != "" {
					data["rabbitmq-password"] = []byte(password)
				}

				return data
			}(),
		},
	}, nil
}
