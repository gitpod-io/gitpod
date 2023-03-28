// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package grpc

import (
	"context"
	"strconv"
	"strings"
	"time"

	"golang.org/x/time/rate"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"

	"github.com/gitpod-io/gitpod/common-go/util"
	lru "github.com/hashicorp/golang-lru"
	"github.com/prometheus/client_golang/prometheus"
)

type keyFunc func(req interface{}) (string, error)

// RateLimit configures the reate limit for a function
type RateLimit struct {
	Block      bool `json:"block"`
	BucketSize uint `json:"bucketSize"`
	// RefillInterval is the rate at which a new token gets added to the bucket.
	// Note that this does _not_ completely refill the bucket, only one token gets added,
	// so effectively this is the rate at which requests can be made.
	RefillInterval util.Duration `json:"refillInterval"`

	// Key is the proto field name to rate limit on. Each unique value of this
	// field gets its own rate limit bucket. Must be a String, Enum, or Boolean field.
	// Can be a composite key by separating fields by comma, e.g. `foo.bar,foo.baz`
	Key string `json:"key,omitempty"`
	// KeyCacheSize is the max number of buckets kept in a LRU cache.
	KeyCacheSize uint `json:"keyCacheSize,omitempty"`
}

func (r RateLimit) Limiter() *rate.Limiter {
	return rate.NewLimiter(rate.Every(time.Duration(r.RefillInterval)), int(r.BucketSize))
}

// NewRatelimitingInterceptor creates a new rate limiting interceptor
func NewRatelimitingInterceptor(f map[string]RateLimit) RatelimitingInterceptor {
	callCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grpc",
		Subsystem: "server",
		Name:      "rate_limiter_calls_total",
	}, []string{"grpc_method", "rate_limited"})
	cacheHitCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grpc",
		Subsystem: "server",
		Name:      "rate_limiter_cache_hit_total",
	}, []string{"grpc_method"})

	funcs := make(map[string]*ratelimitedFunction, len(f))
	for name, fnc := range f {
		var (
			keyedLimit *lru.Cache
			key        keyFunc
		)
		if fnc.Key != "" && fnc.KeyCacheSize > 0 {
			keyedLimit, _ = lru.New(int(fnc.KeyCacheSize))
			key = fieldAccessKey(fnc.Key)
		}

		funcs[name] = &ratelimitedFunction{
			RateLimit:           fnc,
			GlobalLimit:         fnc.Limiter(),
			Key:                 key,
			KeyedLimit:          keyedLimit,
			RateLimitedTotal:    callCounter.WithLabelValues(name, "true"),
			NotRateLimitedTotal: callCounter.WithLabelValues(name, "false"),
			CacheMissTotal:      cacheHitCounter.WithLabelValues(name),
		}
	}
	return RatelimitingInterceptor{
		functions:  funcs,
		collectors: []prometheus.Collector{callCounter, cacheHitCounter},
	}
}

func fieldAccessKey(key string) keyFunc {
	fields := strings.Split(key, ",")
	paths := make([][]string, len(fields))
	for i, field := range fields {
		paths[i] = strings.Split(field, ".")
	}
	return func(req interface{}) (string, error) {
		msg, ok := req.(proto.Message)
		if !ok {
			return "", status.Errorf(codes.Internal, "request was not a protobuf message")
		}

		var composite string
		for i, field := range fields {
			val, ok := getFieldValue(msg.ProtoReflect(), paths[i])
			if !ok {
				return "", status.Errorf(codes.Internal, "Field %s does not exist in message. This is a rate limiting configuration error.", field)
			}
			// It's technically possible that `|` is part of one of the field values, and therefore could cause collisions
			// in composite keys, e.g. values (`a|`, `b`), and (`a`, `|b`) would result in the same composite key `a||b`
			// and share the rate limit. This is highly unlikely though given the current fields we rate limit on and
			// otherwise unlikely to cause issues.
			composite += "|" + val
		}

		return composite, nil
	}
}

func getFieldValue(msg protoreflect.Message, path []string) (val string, ok bool) {
	if len(path) == 0 {
		return "", false
	}

	field := msg.Descriptor().Fields().ByName(protoreflect.Name(path[0]))
	if field == nil {
		return "", false
	}
	if len(path) > 1 {
		if field.Kind() != protoreflect.MessageKind {
			// we should go deeper but the field is not a message
			return "", false
		}
		child := msg.Get(field).Message()
		return getFieldValue(child, path[1:])
	}

	switch field.Kind() {
	case protoreflect.StringKind:
		return msg.Get(field).String(), true
	case protoreflect.EnumKind:
		enumNum := msg.Get(field).Enum()
		return strconv.Itoa(int(enumNum)), true
	case protoreflect.BoolKind:
		if msg.Get(field).Bool() {
			return "t", true
		} else {
			return "f", true
		}

	default:
		// we only support string and enum fields
		return "", false
	}
}

// RatelimitingInterceptor limits how often a gRPC function may be called. If the limit has been
// exceeded, we'll return resource exhausted.
type RatelimitingInterceptor struct {
	functions  map[string]*ratelimitedFunction
	collectors []prometheus.Collector
}

var _ prometheus.Collector = RatelimitingInterceptor{}

func (r RatelimitingInterceptor) Describe(d chan<- *prometheus.Desc) {
	for _, c := range r.collectors {
		c.Describe(d)
	}
}

func (r RatelimitingInterceptor) Collect(m chan<- prometheus.Metric) {
	for _, c := range r.collectors {
		c.Collect(m)
	}
}

type counter interface {
	Inc()
}

type ratelimitedFunction struct {
	RateLimit RateLimit

	GlobalLimit *rate.Limiter
	Key         keyFunc
	KeyedLimit  *lru.Cache

	RateLimitedTotal    counter
	NotRateLimitedTotal counter
	CacheMissTotal      counter
}

// UnaryInterceptor creates a unary interceptor that implements the rate limiting
func (r RatelimitingInterceptor) UnaryInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
		f, ok := r.functions[info.FullMethod]
		if !ok {
			return handler(ctx, req)
		}

		var limit *rate.Limiter
		if f.Key == nil {
			limit = f.GlobalLimit
		} else {
			key, err := f.Key(req)
			if err != nil {
				return nil, err
			}

			found, _ := f.KeyedLimit.ContainsOrAdd(key, f.RateLimit.Limiter())
			if !found && f.CacheMissTotal != nil {
				f.CacheMissTotal.Inc()
			}
			v, _ := f.KeyedLimit.Get(key)
			limit = v.(*rate.Limiter)
		}

		var blocked bool
		defer func() {
			if blocked && f.RateLimitedTotal != nil {
				f.RateLimitedTotal.Inc()
			} else if !blocked && f.NotRateLimitedTotal != nil {
				f.NotRateLimitedTotal.Inc()
			}
		}()
		if f.RateLimit.Block {
			err := limit.Wait(ctx)
			if err == context.Canceled {
				blocked = true
				return nil, err
			}
			if err != nil {
				blocked = true
				return nil, status.Error(codes.ResourceExhausted, err.Error())
			}
		} else if !limit.Allow() {
			blocked = true
			return nil, status.Error(codes.ResourceExhausted, "too many requests")
		}

		return handler(ctx, req)
	}
}
