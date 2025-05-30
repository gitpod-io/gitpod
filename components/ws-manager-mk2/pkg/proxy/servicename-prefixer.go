// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"google.golang.org/grpc"
)

// ServiceNamePrefixerInterceptor adds a prefix to the service name in gRPC method calls for metrics
type ServiceNamePrefixerInterceptor struct {
	// Prefix is added before the first dot in the gRPC method name.
	// For example, if the original method is "/builder.ImageBuilder/Build",
	// and Prefix is "proxied", the modified method will be "/proxied.builder.ImageBuilder/Build".
	Prefix string
}

// UnaryServerInterceptor returns a unary server interceptor that prefixes service names
func (s *ServiceNamePrefixerInterceptor) UnaryServerInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		// Modify the FullMethod to include the prefix
		originalMethod := info.FullMethod
		log.Info("Intercepting gRPC unary call", "method", originalMethod, "prefix", s.Prefix)
		info.FullMethod = s.prefixServiceName(originalMethod)

		// Call the handler with modified info
		resp, err := handler(ctx, req)

		// Restore original method name
		info.FullMethod = originalMethod

		return resp, err
	}
}

// StreamServerInterceptor returns a stream server interceptor that prefixes service names
func (s *ServiceNamePrefixerInterceptor) StreamServerInterceptor() grpc.StreamServerInterceptor {
	return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		// Modify the FullMethod to include the prefix
		originalMethod := info.FullMethod
		log.Info("Intercepting gRPC stream call", "method", originalMethod, "prefix", s.Prefix)
		info.FullMethod = s.prefixServiceName(originalMethod)

		// Call the handler with modified info
		err := handler(srv, ss)

		// Restore original method name
		info.FullMethod = originalMethod

		return err
	}
}

func (s *ServiceNamePrefixerInterceptor) prefixServiceName(fullMethod string) string {
	// fullMethod format is /package.Service/Method
	// We want to change it to /proxied.package.Service/Method using the first dot as anchor
	if s.Prefix == "" || len(fullMethod) == 0 {
		return fullMethod
	}

	// Find the first dot after the leading slash
	if !strings.HasPrefix(fullMethod, "/") {
		return fullMethod // malformed input
	}

	// Look for the first dot in the method name
	dotIndex := strings.Index(fullMethod[1:], ".") // skip the leading slash
	if dotIndex == -1 {
		return fullMethod // no dot found, return original
	}

	// Insert prefix before the first dot
	// /builder.ImageBuilder/Build -> /proxied.builder.ImageBuilder/Build
	prefix := strings.TrimPrefix(strings.TrimSuffix(s.Prefix, "/"), "/")
	return "/" + prefix + "." + fullMethod[1:]
}
