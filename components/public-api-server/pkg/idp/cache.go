// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package idp

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/redis/go-redis/v9"
	"gopkg.in/square/go-jose.v2"
)

// KeyCache caches public keys to ensure they're returned with the JWKS as long
// as there are valid tokens out there using those keys.
//
// PoC Note: in production this cache would likely be implemted using Redis or the database.
type KeyCache interface {
	// Set rotates the current key
	Set(ctx context.Context, current *rsa.PrivateKey) error

	// Signer produces a new key signer or nil if Set() hasn't been called yet
	Signer(ctx context.Context) (jose.Signer, error)

	// PublicKeys returns all un-expired public keys as JSON-encoded *jose.JSONWebKeySet.
	// This function returns the JSON-encoded form directly instead of the *jose.JSONWebKeySet
	// to allow for persisted JSON implementations of this interface.
	PublicKeys(ctx context.Context) ([]byte, error)
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
func (imc *InMemoryCache) Set(ctx context.Context, current *rsa.PrivateKey) error {
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
func (imc *InMemoryCache) Signer(ctx context.Context) (jose.Signer, error) {
	if imc.current == nil {
		return nil, nil
	}

	return jose.NewSigner(jose.SigningKey{
		Algorithm: jose.RS256,
		Key:       imc.current,
	}, nil)
}

// PublicKeys returns all un-expired public keys
func (imc *InMemoryCache) PublicKeys(ctx context.Context) ([]byte, error) {
	imc.mu.RLock()
	defer imc.mu.RUnlock()

	var jwks jose.JSONWebKeySet
	for _, key := range imc.keys {
		jwks.Keys = append(jwks.Keys, jose.JSONWebKey{
			Key:       key.Key,
			KeyID:     key.ID,
			Algorithm: string(jose.RS256),
		})
	}

	return json.Marshal(jwks)
}

const (
	redisCacheDefaultTTL = 1 * time.Hour
	redisIDPKeyPrefix    = "idp:keys:"
)

func NewRedisCache(client *redis.Client) *RedisCache {
	return &RedisCache{Client: client}
}

type RedisCache struct {
	Client *redis.Client

	mu        sync.RWMutex
	current   *rsa.PrivateKey
	currentID string
}

// PublicKeys implements KeyCache
func (rc *RedisCache) PublicKeys(ctx context.Context) ([]byte, error) {
	var (
		res   = []byte("{\"keys\":[")
		first = true
	)

	iter := rc.Client.Scan(ctx, 0, redisIDPKeyPrefix+"*", 0).Iterator()
	for iter.Next(ctx) {
		key, err := rc.Client.Get(ctx, iter.Val()).Result()
		if err != nil {
			return nil, err
		}

		if !first {
			res = append(res, []byte(",")...)
		}
		res = append(res, []byte(key)...)
		first = false
	}
	if err := iter.Err(); err != nil {
		return nil, err
	}
	res = append(res, []byte("]}")...)
	return res, nil
}

// Set implements KeyCache
func (rc *RedisCache) Set(ctx context.Context, current *rsa.PrivateKey) error {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	id := fmt.Sprintf("id-%d-%d", time.Now().UnixMicro(), rand.Int())

	publicKey := jose.JSONWebKey{
		Key:       &current.PublicKey,
		KeyID:     id,
		Algorithm: string(jose.RS256),
	}
	publicKeyJSON, err := json.Marshal(publicKey)
	if err != nil {
		return err
	}

	redisKey := fmt.Sprintf("%s%s", redisIDPKeyPrefix, id)
	err = rc.Client.Set(ctx, redisKey, string(publicKeyJSON), redisCacheDefaultTTL).Err()
	if err != nil {
		return err
	}
	rc.currentID = id
	rc.current = current

	return nil
}

// Signer implements KeyCache
func (rc *RedisCache) Signer(ctx context.Context) (jose.Signer, error) {
	if rc.current == nil {
		return nil, nil
	}

	err := rc.Client.Expire(ctx, redisIDPKeyPrefix+rc.currentID, redisCacheDefaultTTL).Err()
	if err != nil {
		log.WithField("keyID", rc.currentID).WithError(err).Warn("cannot extend cached IDP public key TTL")
	}

	return jose.NewSigner(jose.SigningKey{
		Algorithm: jose.RS256,
		Key:       rc.current,
	}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]interface{}{
			jose.HeaderKey("kid"): rc.currentID,
		},
	})
}

var _ KeyCache = ((*RedisCache)(nil))
