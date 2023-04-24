// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
)

type Config struct {
	PKI PKIConfig `json:"pki"`

	// Configration parameters for user sessions
	Session SessionConfig `json:"session"`
}

type SessionConfig struct {
	// How long shoud the session be valid for?
	LifetimeSeconds int64  `json:"lifetimeSeconds"`
	Issuer          string `json:"issuer"`
}

func GetConfig(ctx *common.RenderContext) ([]corev1.Volume, []corev1.VolumeMount, Config) {
	volumes, mounts, pki := getPKI()
	return volumes, mounts, Config{
		PKI: pki,
		Session: SessionConfig{
			LifetimeSeconds: int64((7 * 24 * time.Hour).Seconds()),
			Issuer:          fmt.Sprintf("https://%s", ctx.Config.Domain),
		},
	}
}
