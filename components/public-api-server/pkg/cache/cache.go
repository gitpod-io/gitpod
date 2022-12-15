// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cache

import (
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"time"

	"github.com/allegro/bigcache"
	"github.com/eko/gocache/cache"
	"github.com/eko/gocache/store"
	"golang.org/x/xerrors"
)

type CacheManager struct {
	cacheManager *cache.Cache
}

func NewCacheManager(cacheDurationBackup time.Duration) (*CacheManager, error) {
	var cacheStore store.StoreInterface

	// if o.Config.RedisEnabled() {
	// 	redisClient := redis.NewClient(&redis.Options{Addr: o.Config.RedisAddr})
	// 	cacheStore = store.NewRedis(redisClient, nil)
	// } else {
	bigcacheClient, err := bigcache.NewBigCache(bigcache.DefaultConfig(time.Duration(cacheDurationBackup)))
	if err != nil {
		return nil, err
	}
	cacheStore = store.NewBigcache(bigcacheClient, nil)
	// }

	return &CacheManager{cacheManager: cache.New(cacheStore)}, nil
}

func (this *CacheManager) StoreCache(key string, data []byte) error {
	// if o.Config.RedisEnabled() {
	// 	return this.cacheManager.Set(key, string(data), nil)
	// }
	return this.cacheManager.Set(key, data, nil)
}

func (this *CacheManager) ReadCache(key string) ([]byte, error) {
	b, err := this.cacheManager.Get(key)
	if err == bigcache.ErrEntryNotFound /* || err == redis.Nil */ {
		return nil, nil
	} else if err != nil || b == nil {
		return nil, err
	}
	// var data []byte
	// if o.Config.RedisEnabled() {
	// 	data = []byte(b.(string))
	// } else {
	data := b.([]byte)
	// }

	return data, nil
}

func CacheKey(procedure string, msg any) (string, error) {
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return "", xerrors.Errorf("cannot convert message object to JSON: %v", err)
	}

	hash := sha1.New()
	hash.Write([]byte(procedure))
	hash.Write([]byte(msgBytes))
	digest := hash.Sum(nil)
	return fmt.Sprintf("%x", digest), nil
}
