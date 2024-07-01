// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package public_api_server

import (
	"fmt"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/components/redis"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/google/go-cmp/cmp"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestConfigMap(t *testing.T) {
	ctx := renderContextWithPublicAPI(t)
	objs, err := configmap(ctx)
	require.NoError(t, err)

	require.Len(t, objs, 1, "must only render one configmap")

	var stripeSecretPath string
	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		_, _, stripeSecretPath, _ = getStripeConfig(ucfg)
		return nil
	})

	var personalAccessTokenSigningKeyPath string
	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		_, _, personalAccessTokenSigningKeyPath, _ = getPersonalAccessTokenSigningKey(ucfg)
		return nil
	})

	expectedConfiguration := config.Configuration{
		PublicURL:                         fmt.Sprintf("https://services.%s", ctx.Config.Domain),
		GitpodServiceURL:                  fmt.Sprintf("ws://server.%s.svc.cluster.local:3000", ctx.Namespace),
		BillingServiceAddress:             fmt.Sprintf("usage.%s.svc.cluster.local:9001", ctx.Namespace),
		SessionServiceAddress:             fmt.Sprintf("server.%s.svc.cluster.local:9876", ctx.Namespace),
		StripeWebhookSigningSecretPath:    stripeSecretPath,
		PersonalAccessTokenSigningKeyPath: personalAccessTokenSigningKeyPath,
		DatabaseConfigPath:                "/secrets/database-config",
		Redis: config.RedisConfiguration{
			Address: fmt.Sprintf("%s.%s.svc.cluster.local:%d", redis.Component, ctx.Namespace, redis.Port),
		},
		Auth: config.AuthConfiguration{
			PKI: config.AuthPKIConfiguration{
				Signing: config.KeyPair{
					ID:             "0001",
					PublicKeyPath:  "/secrets/auth-pki/signing/tls.crt",
					PrivateKeyPath: "/secrets/auth-pki/signing/tls.key",
				},
			},
			Session: config.SessionConfig{
				LifetimeSeconds: int64((24 * 7 * time.Hour).Seconds()),
				Issuer:          "https://test.domain.everything.awesome.is",
				Cookie: config.CookieConfig{
					Name:     "__Host-_test_domain_everything_awesome_is_jwt2_",
					MaxAge:   int64((24 * 7 * time.Hour).Seconds()),
					SameSite: "lax",
					Secure:   true,
					HTTPOnly: true,
				},
			},
		},
		Server: &baseserver.Configuration{
			Services: baseserver.ServicesConfiguration{
				GRPC: &baseserver.ServerConfiguration{
					Address: fmt.Sprintf("0.0.0.0:%d", GRPCContainerPort),
				},
				HTTP: &baseserver.ServerConfiguration{
					Address: fmt.Sprintf("0.0.0.0:%d", HTTPContainerPort),
				},
			},
		},
	}

	expectedJSON, err := common.ToJSONString(expectedConfiguration)
	require.NoError(t, err)

	cm := objs[0].(*corev1.ConfigMap)

	expectation := &corev1.ConfigMap{
		TypeMeta: common.TypeMetaConfigmap,
		ObjectMeta: metav1.ObjectMeta{
			Name:        Component,
			Namespace:   ctx.Namespace,
			Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
			Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
		},
		Data: map[string]string{
			"config.json": string(expectedJSON),
		},
	}
	if diff := cmp.Diff(expectation, cm); diff != "" {
		t.Errorf("configMap mismatch (-want +got):\n%s", diff)
	}
}
