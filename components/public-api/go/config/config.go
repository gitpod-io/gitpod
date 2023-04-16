// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import "github.com/gitpod-io/gitpod/common-go/baseserver"

type Configuration struct {
	// PublicURL is the URL under which the API server is publicly reachable
	PublicURL string `json:"publicURL"`

	GitpodServiceURL string `json:"gitpodServiceUrl"`

	BillingServiceAddress string `json:"billingServiceAddress,omitempty"`

	// Address to use for creating new sessions
	SessionServiceAddress string `json:"sessionServiceAddress"`

	// StripeWebhookSigningSecretPath is a filepath to a secret used to validate incoming webhooks from Stripe
	StripeWebhookSigningSecretPath string `json:"stripeWebhookSigningSecretPath"`

	// OIDCClientJWTSigningSecretPath is a filepath to a secret used to sign and validate JWTs used for OIDC flows
	OIDCClientJWTSigningSecretPath string `json:"oidcClientJWTSigningSecretPath"`

	// Path to file which contains personal access token singing key
	PersonalAccessTokenSigningKeyPath string `json:"personalAccessTokenSigningKeyPath"`

	// Path to directory containing database configuration files
	DatabaseConfigPath string `json:"databaseConfigPath"`

	// Redis configures the connection to Redis
	Redis RedisConfiguration `json:"redis"`

	// Authentication configuration
	Auth AuthConfiguration `json:"auth"`

	Server *baseserver.Configuration `json:"server,omitempty"`
}

type RedisConfiguration struct {

	// Address configures the redis connection of this component
	Address string `json:"address"`
}

type AuthConfiguration struct {
	PKI AuthPKIConfiguration `json:"pki"`
}

type AuthPKIConfiguration struct {
	Signing    KeyPair   `json:"signing"`
	Validating []KeyPair `json:"validating"`
}

type KeyPair struct {
	ID             string `json:"id"`
	PublicKeyPath  string `json:"publicKeyPath"`
	PrivateKeyPath string `json:"privateKeyPath"`
}
