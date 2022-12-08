// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package public_api_server

import (
	"fmt"
	"net"
	"strconv"

	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/usage"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

const (
	configJSONFilename = "config.json"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var stripeSecretPath string
	var personalAccessTokenSigningKeyPath string

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		_, _, stripeSecretPath, _ = getStripeConfig(cfg)
		return nil
	})

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		_, _, personalAccessTokenSigningKeyPath, _ = getPersonalAccessTokenSigningKey(cfg)
		return nil
	})

	cfg := config.Configuration{
		GitpodServiceURL:                  fmt.Sprintf("wss://%s", ctx.Config.Domain),
		StripeWebhookSigningSecretPath:    stripeSecretPath,
		PersonalAccessTokenSigningKeyPath: personalAccessTokenSigningKeyPath,
		BillingServiceAddress:             net.JoinHostPort(fmt.Sprintf("%s.%s.svc.cluster.local", usage.Component, ctx.Namespace), strconv.Itoa(usage.GRPCServicePort)),
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

	fc, err := common.ToJSONString(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        Component,
				Namespace:   ctx.Namespace,
				Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
			},
			Data: map[string]string{
				configJSONFilename: string(fc),
			},
		},
	}, nil
}

func getStripeConfig(cfg *experimental.Config) (corev1.Volume, corev1.VolumeMount, string, bool) {
	var volume corev1.Volume
	var mount corev1.VolumeMount
	var path string

	if cfg == nil || cfg.WebApp == nil || cfg.WebApp.PublicAPI == nil || cfg.WebApp.PublicAPI.StripeSecretName == "" {
		return volume, mount, path, false
	}

	stripeSecret := cfg.WebApp.PublicAPI.StripeSecretName
	path = stripeSecretMountPath

	volume = corev1.Volume{
		Name: "stripe-secret",
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: stripeSecret,
				Optional:   pointer.Bool(true),
			},
		},
	}

	mount = corev1.VolumeMount{
		Name:      "stripe-secret",
		MountPath: stripeSecretMountPath,
		SubPath:   "stripe-webhook-secret",
		ReadOnly:  true,
	}

	return volume, mount, path, true
}

func getPersonalAccessTokenSigningKey(cfg *experimental.Config) (corev1.Volume, corev1.VolumeMount, string, bool) {
	var volume corev1.Volume
	var mount corev1.VolumeMount
	var path string

	if cfg == nil || cfg.WebApp == nil || cfg.WebApp.PublicAPI == nil || cfg.WebApp.PublicAPI.PersonalAccessTokenSigningKeySecretName == "" {
		return volume, mount, path, false
	}

	personalAccessTokenSecretname := cfg.WebApp.PublicAPI.PersonalAccessTokenSigningKeySecretName
	path = personalAccessTokenSigningKeyMountPath

	volume = corev1.Volume{
		Name: "personal-access-token-signing-key",
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: personalAccessTokenSecretname,
				Optional:   pointer.Bool(true),
			},
		},
	}

	mount = corev1.VolumeMount{
		Name:      "personal-access-token-signing-key",
		MountPath: personalAccessTokenSigningKeyMountPath,
		SubPath:   "personal-access-token-signing-key",
		ReadOnly:  true,
	}

	return volume, mount, path, true
}
