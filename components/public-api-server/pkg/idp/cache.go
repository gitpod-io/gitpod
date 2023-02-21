// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package idp

import (
	"crypto/rsa"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"gopkg.in/square/go-jose.v2"
)

// KeyCache caches public keys to ensure they're returned with the JWKS as long
// as there are valid tokens out there using those keys.
//
// PoC Note: in production this cache would likely be implemted using Redis or the database.
type KeyCache interface {
	// Set rotates the current key
	Set(current *rsa.PrivateKey) error

	// Signer produces a new key signer or nil if Set() hasn't been called yet
	Signer() (jose.Signer, error)

	// PublicKeys returns all un-expired public keys
	PublicKeys() (*jose.JSONWebKeySet, error)
}

type inMemoryKey struct {
	ID      string
	Created time.Time
	Key     *rsa.PublicKey
}

func NewInMemoryCache() *InMemoryCache {
	return &InMemoryCache{
		keys: make(map[string]*inMemoryKey),
	}
}

type InMemoryCache struct {
	mu        sync.RWMutex
	current   *rsa.PrivateKey
	currentID string

	keys map[string]*inMemoryKey
}

// Set rotates the current key
func (imc *InMemoryCache) Set(current *rsa.PrivateKey) error {
	imc.mu.Lock()
	defer imc.mu.Unlock()

	id := fmt.Sprintf("id%d%d", time.Now().Unix(), rand.Int())
	imc.currentID = id
	imc.current = current
	imc.keys[id] = &inMemoryKey{
		ID:      id,
		Created: time.Now(),
		Key:     &current.PublicKey,
	}
	return nil
}

// Signer produces a new key signer or nil if Set() hasn't been called yet
func (imc *InMemoryCache) Signer() (jose.Signer, error) {
	if imc.current == nil {
		return nil, nil
	}

	return jose.NewSigner(jose.SigningKey{
		Algorithm: jose.RS256,
		Key:       imc.current,
	}, nil)
}

// PublicKeys returns all un-expired public keys
func (imc *InMemoryCache) PublicKeys() (*jose.JSONWebKeySet, error) {
	imc.mu.RLock()
	defer imc.mu.RUnlock()

	var res jose.JSONWebKeySet
	for _, key := range imc.keys {
		res.Keys = append(res.Keys, jose.JSONWebKey{
			Key:       key.Key,
			KeyID:     key.ID,
			Algorithm: string(jose.RS256),
		})
	}

	return &res, nil
}
