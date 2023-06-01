// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package identityprovider

import (
	"context"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/redis/go-redis/v9"
	"gopkg.in/square/go-jose.v2"
)

// KeyCache caches public keys to ensure they're returned with the JWKS as long
// as there are valid tokens out there using those keys.
//
// PoC Note: in production this cache would likely be implemented using Redis or the database.
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

type RedisCache struct {
	Client *redis.Client

	keyID     func(current *rsa.PrivateKey) string
	mu        sync.RWMutex
	current   *rsa.PrivateKey
	currentID string
}

type redisCacheOpt struct {
	refreshPeriod time.Duration
}

type redisCacheOption func(*redisCacheOpt)

func WithRefreshPeriod(t time.Duration) redisCacheOption {
	return func(opt *redisCacheOpt) {
		opt.refreshPeriod = t
	}
}

func NewRedisCache(ctx context.Context, client *redis.Client, opts ...redisCacheOption) *RedisCache {
	opt := &redisCacheOpt{
		refreshPeriod: 10 * time.Minute,
	}
	for _, o := range opts {
		o(opt)
	}
	cache := &RedisCache{
		Client: client,
		keyID:  defaultKeyID,
	}
	go cache.sync(ctx, opt.refreshPeriod)
	return cache
}

func defaultKeyID(current *rsa.PrivateKey) string {
	hashed := sha256.Sum256(current.N.Bytes())
	return fmt.Sprintf("id-%s", hex.EncodeToString(hashed[:]))
}

// PublicKeys implements KeyCache
func (rc *RedisCache) PublicKeys(ctx context.Context) ([]byte, error) {
	var (
		res           = []byte("{\"keys\":[")
		first         = true
		hasCurrentKey = false
	)

	if rc.current != nil && rc.currentID != "" {
		hasCurrentKey = true
		fc, err := serializePublicKeyAsJSONWebKey(rc.currentID, &rc.current.PublicKey)
		if err != nil {
			return nil, err
		}
		res = append(res, fc...)
		first = false
	}

	iter := rc.Client.Scan(ctx, 0, redisIDPKeyPrefix+"*", 0).Iterator()
	for iter.Next(ctx) {
		idx := iter.Val()
		if hasCurrentKey && strings.HasSuffix(idx, rc.currentID) {
			// We've already added the public key we hold in memory
			continue
		}
		key, err := rc.Client.Get(ctx, idx).Result()
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

func serializePublicKeyAsJSONWebKey(keyID string, key *rsa.PublicKey) ([]byte, error) {
	publicKey := jose.JSONWebKey{
		Key:       key,
		KeyID:     keyID,
		Algorithm: string(jose.RS256),
	}
	return json.Marshal(publicKey)
}

// Set implements KeyCache
func (rc *RedisCache) Set(ctx context.Context, current *rsa.PrivateKey) error {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	err := rc.persistPublicKey(ctx, current)
	if err != nil {
		return err
	}
	rc.currentID = rc.keyID(current)
	rc.current = current

	return nil
}

func (rc *RedisCache) persistPublicKey(ctx context.Context, current *rsa.PrivateKey) error {
	id := rc.keyID(current)

	publicKeyJSON, err := serializePublicKeyAsJSONWebKey(id, &current.PublicKey)
	if err != nil {
		return err
	}

	redisKey := fmt.Sprintf("%s%s", redisIDPKeyPrefix, id)
	err = rc.Client.Set(ctx, redisKey, string(publicKeyJSON), redisCacheDefaultTTL).Err()
	if err != nil {
		return err
	}

	return nil
}

// Signer implements KeyCache
func (rc *RedisCache) Signer(ctx context.Context) (jose.Signer, error) {
	if rc.current == nil {
		return nil, nil
	}

	if err := rc.reconcile(ctx); err != nil {
		return nil, err
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

func (rc *RedisCache) reconcile(ctx context.Context) error {
	if rc.current == nil {
		return nil
	}

	resp := rc.Client.Expire(ctx, redisIDPKeyPrefix+rc.currentID, redisCacheDefaultTTL)
	if err := resp.Err(); err != nil {
		log.WithField("keyID", rc.currentID).WithError(err).Warn("cannot extend cached IDP public key TTL")
	}
	if !resp.Val() {
		log.WithField("keyID", rc.currentID).Warn("cannot extend cached IDP public key TTL - trying to repersist")
		err := rc.persistPublicKey(ctx, rc.current)
		if err != nil {
			log.WithField("keyID", rc.currentID).WithError(err).Error("cannot repersist public key")
			return err
		}
	}
	return nil
}

func (rc *RedisCache) sync(ctx context.Context, period time.Duration) {
	ticker := time.NewTicker(period)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = rc.reconcile(ctx)
		}
	}
}

var _ KeyCache = ((*RedisCache)(nil))
