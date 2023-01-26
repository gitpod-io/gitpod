// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func secret(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := getExperimentalSpiceDBConfig(ctx)
	if cfg == nil {
		return nil, nil
	}

	// There's a secret-ref provided, we do not need to create a secret
	if cfg.SecretRef != "" {
		return nil, nil
	}

	generated, err := common.RandomString(20)
	if err != nil {
		return nil, fmt.Errorf("failed to generate spicedb preshared key: %w", err)
	}

	return []runtime.Object{
		&corev1.Secret{
			TypeMeta: common.TypeMetaSecret,
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretRef(cfg),
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string][]byte{
				SecretPresharedKeyName: []byte(generated),
			},
		},
	}, nil
}

func secretRef(cfg *experimental.SpiceDBConfig) string {
	if cfg.SecretRef != "" {
		return cfg.SecretRef
	}

	return fmt.Sprintf("%s-secret", Component)

}
