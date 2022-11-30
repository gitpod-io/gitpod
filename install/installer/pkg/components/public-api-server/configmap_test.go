// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package public_api_server

import (
	"fmt"
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

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

	_, _, personalAccessTokenSigningKeyPath, _ := getPersonalAccessTokenSigningKey(ctx.Config)

	expectedConfiguration := config.Configuration{
		GitpodServiceURL:                  "wss://test.domain.everything.awesome.is",
		BillingServiceAddress:             fmt.Sprintf("usage.%s.svc.cluster.local:9001", ctx.Namespace),
		StripeWebhookSigningSecretPath:    stripeSecretPath,
		PersonalAccessTokenSigningKeyPath: personalAccessTokenSigningKeyPath,
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
	require.Equal(t, &corev1.ConfigMap{
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
	}, cm)
}
