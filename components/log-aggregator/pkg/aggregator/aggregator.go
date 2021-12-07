// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package aggregator

import (
	"github.com/go-redis/redis/v8"

	"github.com/gitpod-io/gitpod/log-aggregator/api"
	"github.com/gitpod-io/gitpod/log-aggregator/api/config"
)

func New(cfg *config.Configuration) (*Aggregator, error) {
	cl := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddress,
	})

	return &Aggregator{
		client: cl,
	}, nil
}

type Aggregator struct {
	client *redis.Client

	api.UnimplementedAggregatorServer
	api.UnimplementedIngesterServer
}
