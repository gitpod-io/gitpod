// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import "github.com/gitpod-io/gitpod/common-go/baseserver"

type Configuration struct {
	GitpodServiceURL string `json:"gitpodServiceUrl"`

	BillingServiceAddress string `json:"billingServiceAddress,omitempty"`

	OIDCServiceAddress string `json:"oidcServiceAddress,omitempty"`

	// StripeWebhookSigningSecretPath is a filepath to a secret used to validate incoming webhooks from Stripe
	StripeWebhookSigningSecretPath string `json:"stripeWebhookSigningSecretPath"`

	// Path to file which contains personal access token singing key
	PersonalAccessTokenSigningKeyPath string `json:"personalAccessTokenSigningKeyPath"`

	// Path to directory containing database configuration files
	DatabaseConfigPath string `json:"databaseConfigPath"`

	Server *baseserver.Configuration `json:"server,omitempty"`
}
