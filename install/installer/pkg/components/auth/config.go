// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	server_lib "github.com/gitpod-io/gitpod/server/go/pkg/lib"
	corev1 "k8s.io/api/core/v1"
)

type Config struct {
	PKI PKIConfig `json:"pki"`

	// Configration parameters for user sessions
	Session SessionConfig `json:"session"`
}

type SessionConfig struct {
	// How long shoud the session be valid for?
	LifetimeSeconds int64        `json:"lifetimeSeconds"`
	Issuer          string       `json:"issuer"`
	Cookie          CookieConfig `json:"cookie"`
}

type CookieConfig struct {
	Name     string `json:"name"`
	MaxAge   int64  `json:"maxAge"`
	SameSite string `json:"sameSite"`
	Secure   bool   `json:"secure"`
	HTTPOnly bool   `json:"httpOnly"`
}

func GetConfig(ctx *common.RenderContext) ([]corev1.Volume, []corev1.VolumeMount, Config) {
	volumes, mounts, pki := getPKI()
	lifetime := int64((7 * 24 * time.Hour).Seconds())
	return volumes, mounts, Config{
		PKI: pki,
		Session: SessionConfig{
			LifetimeSeconds: lifetime,
			Issuer:          fmt.Sprintf("https://%s", ctx.Config.Domain),
			Cookie: CookieConfig{
				// Caution: changing these have security implications for the application. Make sure you understand what you're doing.
				Name:     server_lib.CookieNameFromDomain(ctx.Config.Domain),
				MaxAge:   lifetime,
				SameSite: "lax",
				Secure:   true,
				HTTPOnly: true,
			},
		},
	}
}
