// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package jws

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io/ioutil"

	"github.com/gitpod-io/gitpod/components/public-api/go/config"
)

type Key struct {
	ID      string
	Private *rsa.PrivateKey
	Raw     []byte
	// We don't need PublicKey because we can derive the public key from the private key
}

// KeySet encodes a collection of keys to use
// There's always a Signing key, but optionally there are also
// older keys which can be used to verify.
type KeySet struct {
	Signing    Key
	Validating []Key
}

func NewKeySetFromAuthPKI(pki config.AuthPKIConfiguration) (KeySet, error) {
	signing, err := readKeyPair(pki.Signing)
	if err != nil {
		return KeySet{}, fmt.Errorf("failed to read signing key: %w", err)
	}

	var validating []Key
	for _, keypair := range pki.Validating {
		key, err := readKeyPair(keypair)
		if err != nil {
			return KeySet{}, fmt.Errorf("failed to read validating key: %w", err)
		}

		validating = append(validating, key)
	}

	return KeySet{
		Signing:    signing,
		Validating: validating,
	}, nil
}

func readKeyPair(keypair config.KeyPair) (Key, error) {
	pk, raw, err := readPrivateKeyFromFile(keypair.PrivateKeyPath)
	if err != nil {
		return Key{}, err
	}

	return Key{
		ID:      keypair.ID,
		Private: pk,
		Raw:     raw,
	}, nil
}

func readPrivateKeyFromFile(filepath string) (*rsa.PrivateKey, []byte, error) {
	bytes, err := ioutil.ReadFile(filepath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read private key from %s: %w", filepath, err)
	}

	block, _ := pem.Decode(bytes)
	parseResult, _ := x509.ParsePKCS8PrivateKey(block.Bytes)
	key, ok := parseResult.(*rsa.PrivateKey)
	if !ok {
		return nil, nil, fmt.Errorf("file %s does not contain RSA Private Key", filepath)
	}

	return key, bytes, nil
}
