// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io/ioutil"

	"github.com/lestrrat-go/jwx/v2/jwk"
)

type Key struct {
	ID             string
	PrivateKeyPath string
}

type KeyStoreOpts struct {
	Signing    Key
	Validating []Key
}

func NewKeyStore(opts KeyStoreOpts) (jwk.Set, error) {
	keys := append([]Key{opts.Signing}, opts.Validating...)
	set := jwk.NewSet()

	for _, key := range keys {
		jwkKey, err := readPrivateRSA(key)
		if err != nil {
			return nil, fmt.Errorf("failed to read private RSA key: %w", err)
		}

		if err := set.AddKey(jwkKey); err != nil {
			return nil, fmt.Errorf("failed to add jwt key to keyset: %w", err)
		}
	}

	return set, nil
}

func readPrivateRSA(key Key) (jwk.Key, error) {
	bytes, err := ioutil.ReadFile(key.PrivateKeyPath)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(bytes)
	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key")
	}

	jwkKey, err := jwk.FromRaw(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to parse raw private key")
	}

	// Set the unique Key ID
	err = jwkKey.Set("kid", key.ID)
	if err != nil {
		return nil, err
	}

	return jwkKey, nil
}
