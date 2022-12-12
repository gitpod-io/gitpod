// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"bytes"
	"encoding/json"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
)

type Configuration struct {
	// Namespace describes which namespace the below secrets locates.
	Namespace string `json:"namespace"`

	// CredentialSecret points to a Kubernetes secret which contains the credential to rotate
	// the container registry credential .
	CredentialSecret string `json:"credentialSecret"`

	// Region describes which public cloud region the container registry locates.
	Region string `json:"region"`

	// SecretToUpdate names a Kubernetes secret which contains a `.dockerconfigjson` entry
	// carrying the Docker authentication credentials.
	SecretToUpdate string `json:"secretToUpdate"`
}

func Get(cfgFile string) *Configuration {
	ctnt, err := os.ReadFile(cfgFile)
	if err != nil {
		log.WithError(err).Fatal("cannot read configuration. Maybe missing --config?")
	}

	var cfg Configuration
	err = json.NewDecoder(bytes.NewReader(ctnt)).Decode(&cfg)
	if err != nil {
		log.WithError(err).Fatal("cannot decode configuration. Maybe missing --config?")
	}
	return &cfg
}
