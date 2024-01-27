// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package identityprovider

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"sort"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/go-cmp/cmp"
	"github.com/redis/go-redis/v9"
	"gopkg.in/square/go-jose.v2"
)

func testKeyID(k *rsa.PrivateKey) string {
	return base64.RawURLEncoding.EncodeToString(k.PublicKey.N.Bytes())[0:12]
}

func sortKeys(jwks *jose.JSONWebKeySet) {
	sort.Slice(jwks.Keys, func(i, j int) bool {
		var (
			ki = jwks.Keys[i]
			kj = jwks.Keys[j]
		)
		return ki.KeyID < kj.KeyID
	})
}

func TestRedisCachePublicKeys(t *testing.T) {
	var (
		jwks      jose.JSONWebKeySet
		threeKeys []*rsa.PrivateKey
	)
	for i := 0; i < 3; i++ {
		key, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			panic(err)
		}
		threeKeys = append(threeKeys, key)
		jwks.Keys = append(jwks.Keys, jose.JSONWebKey{
			Key:       &key.PublicKey,
			Algorithm: string(jose.RS256),
			KeyID:     testKeyID(key),
		})
	}
	sortKeys(&jwks)
	threeKeysExpectation, err := json.Marshal(jwks)
	if err != nil {
		panic(err)
	}

	type Expectation struct {
		Error    string
		Response []byte
	}
	type Test struct {
		Name        string
		Keys        []*rsa.PrivateKey
		StateMod    func(*redis.Client) error
		Expectation Expectation
	}
	tests := []Test{
		{
			Name: "redis down",
			Keys: threeKeys,
			StateMod: func(c *redis.Client) error {
				return c.FlushAll(context.Background()).Err()
			},
			Expectation: Expectation{
				Response: func() []byte {
					fc, err := serializePublicKeyAsJSONWebKey(testKeyID(threeKeys[2]), &threeKeys[2].PublicKey)
					if err != nil {
						panic(err)
					}
					return []byte(`{"keys":[` + string(fc) + `]}`)
				}(),
			},
		},
		{
			Name: "no keys",
			Expectation: Expectation{
				Response: []byte(`{"keys":[]}`),
			},
		},
		{
			Name: "no key in memory",
			StateMod: func(c *redis.Client) error {
				return c.Set(context.Background(), redisIDPKeyPrefix+"foo", `{"kty":"RSA","kid":"fpp","alg":"RS256","n":"VGVsbCBDaHJpcyB5b3UgZm91bmQgdGhpcyAtIGRyaW5rJ3Mgb24gbWU","e":"AQAB"}`, 0).Err()
			},
			Expectation: Expectation{
				Response: []byte(`{"keys":[{"kty":"RSA","kid":"fpp","alg":"RS256","n":"VGVsbCBDaHJpcyB5b3UgZm91bmQgdGhpcyAtIGRyaW5rJ3Mgb24gbWU","e":"AQAB"}]}`),
			},
		},
		{
			Name: "multiple keys",
			Keys: threeKeys,
			Expectation: Expectation{
				Response: threeKeysExpectation,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			s := miniredis.RunT(t)
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(func() {
				cancel()
			})
			client := redis.NewClient(&redis.Options{Addr: s.Addr()})
			cache := NewRedisCache(ctx, client)
			cache.keyID = testKeyID
			for _, key := range test.Keys {
				err := cache.Set(context.Background(), key)
				if err != nil {
					t.Fatal(err)
				}
			}
			if test.StateMod != nil {
				err := test.StateMod(client)
				if err != nil {
					t.Fatal(err)
				}
			}

			var (
				act Expectation
				err error
			)
			fc, err := cache.PublicKeys(context.Background())
			if err != nil {
				act.Error = err.Error()
			}
			if len(fc) > 0 {
				var res jose.JSONWebKeySet
				err = json.Unmarshal(fc, &res)
				if err != nil {
					t.Fatal(err)
				}
				sortKeys(&res)
				act.Response, err = json.Marshal(&res)
				if err != nil {
					t.Fatal(err)
				}
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("PublicKeys() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRedisCacheSigner(t *testing.T) {
	s := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: s.Addr()})
	cache := NewRedisCache(context.Background(), client)

	sig, err := cache.Signer(context.Background())
	if sig != nil {
		t.Error("Signer() returned a signer despite having no key set")
	}
	if err != nil {
		t.Errorf("Signer() returned an despite having no key set: %v", err)
	}

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	err = cache.Set(context.Background(), key)
	if err != nil {
		t.Fatalf("RedisCache failed to Set current key but shouldn't have: %v", err)
	}

	sig, err = cache.Signer(context.Background())
	if sig == nil {
		t.Error("Signer() returned nil even though a key was set")
	}
	if err != nil {
		t.Error("Signer() returned an error even though a key was set")
	}

	signature, err := sig.Sign([]byte("foo"))
	if err != nil {
		t.Fatal(err)
	}
	_, err = signature.Verify(&key.PublicKey)
	if err != nil {
		t.Errorf("Returned signer does not sign with currently set key")
	}

	err = client.FlushAll(context.Background()).Err()
	if err != nil {
		t.Fatal(err)
	}
	_, err = cache.Signer(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	keys := client.Keys(context.Background(), redisIDPKeyPrefix+"*").Val()
	if len(keys) == 0 {
		t.Error("getting a new signer did not repersist the key")
	}
}

func TestRedisPeriodicallySync(t *testing.T) {
	s := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: s.Addr()})
	cache := NewRedisCache(context.Background(), client, WithRefreshPeriod(1*time.Second))

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	err = cache.Set(context.Background(), key)
	if err != nil {
		t.Fatalf("RedisCache failed to Set current key but shouldn't have: %v", err)
	}
	err = client.FlushAll(context.Background()).Err()
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(3 * time.Second)
	keys := client.Keys(context.Background(), redisIDPKeyPrefix+"*").Val()
	if len(keys) == 0 {
		t.Error("redis periodically sync won't work")
	}
}
