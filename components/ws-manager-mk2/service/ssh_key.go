// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package service

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"

	"golang.org/x/crypto/ssh"
)

// KeyPair holds the public and private key PEM block bytes encoded in base64
type KeyPair struct {
	PublicKey  string
	PrivateKey string
}

type KeyPairGenerator interface {
	Generate() (*KeyPair, error)
}

// GenerateSSHKeyPair generates a keypair based on KeyPairType.
func GenerateSSHKeyPair() (*KeyPair, error) {
	return NewEd25519Generator().Generate()
}

type Ed25519Generator struct{}

func NewEd25519Generator() KeyPairGenerator {
	return &Ed25519Generator{}
}

func (g *Ed25519Generator) Generate() (*KeyPair, error) {
	pk, pv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	pub, err := generatePublicKey(pk)
	if err != nil {
		return nil, err
	}
	priv, err := encodePrivateKeyToPEM(pv)
	if err != nil {
		return nil, err
	}
	return &KeyPair{
		PublicKey:  base64.StdEncoding.EncodeToString(pub),
		PrivateKey: base64.StdEncoding.EncodeToString(priv),
	}, nil
}

func generatePublicKey(pk interface{}) ([]byte, error) {
	b, err := ssh.NewPublicKey(pk)
	if err != nil {
		return nil, err
	}
	k := ssh.MarshalAuthorizedKey(b)
	return k, nil
}

// encodePrivateKeyToPEM encodes the given private key to a PEM block.
func encodePrivateKeyToPEM(pk interface{}) ([]byte, error) {
	b, err := x509.MarshalPKCS8PrivateKey(pk)
	if err != nil {
		return nil, err
	}
	block := pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: b,
	}
	return pem.EncodeToMemory(&block), nil
}
