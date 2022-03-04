// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package grpc

import (
	"context"
	"time"

	"golang.org/x/time/rate"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/util"
)

// RateLimit configures the reate limit for a function
type RateLimit struct {
	Block          bool          `json:"block"`
	BucketSize     uint          `json:"bucketSize"`
	RefillInterval util.Duration `json:"refillInterval"`
}

// NewRatelimitingInterceptor creates a new rate limiting interceptor
func NewRatelimitingInterceptor(f map[string]RateLimit) RatelimitingInterceptor {
	funcs := make(map[string]ratelimitedFunction, len(f))
	for name, fnc := range f {
		funcs[name] = ratelimitedFunction{
			Block: fnc.Block,
			L:     rate.NewLimiter(rate.Every(time.Duration(fnc.RefillInterval)), int(fnc.BucketSize)),
		}
	}
	return funcs
}

// RatelimitingInterceptor limits how often a gRPC function may be called. If the limit has been
// exceeded, we'll return resource exhausted.
type RatelimitingInterceptor map[string]ratelimitedFunction

type ratelimitedFunction struct {
	Block bool
	L     *rate.Limiter
}

// UnaryInterceptor creates a unary interceptor that implements the rate limiting
func (r RatelimitingInterceptor) UnaryInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
		f, ok := r[info.FullMethod]
		if ok {
			if f.Block {
				err := f.L.Wait(ctx)
				if err == context.Canceled {
					return nil, err
				}
				if err != nil {
					return nil, status.Error(codes.ResourceExhausted, err.Error())
				}
			} else if !f.L.Allow() {
				return nil, status.Error(codes.ResourceExhausted, "too many requests")
			}
		}

		return handler(ctx, req)
	}
}
