// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"encoding/json"
	"os"

	"github.com/stripe/stripe-go/v72"
)

type stripeKeys struct {
	PublishableKey string `json:"publishableKey"`
	SecretKey      string `json:"secretKey"`
}

func Authenticate(apiKeyFile string) error {
	bytes, err := os.ReadFile(apiKeyFile)
	if err != nil {
		return err
	}

	var stripeKeys stripeKeys
	err = json.Unmarshal(bytes, &stripeKeys)
	if err != nil {
		return err
	}

	stripe.Key = stripeKeys.SecretKey
	return nil
}
