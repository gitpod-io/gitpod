// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"testing"
)

func TestServiceNamePrefixerInterceptor_prefixServiceName(t *testing.T) {
	tests := []struct {
		name       string
		prefix     string
		fullMethod string
		expected   string
	}{
		// Normal cases
		{
			name:       "basic service with single dot",
			prefix:     "proxied",
			fullMethod: "/builder.ImageBuilder/Build",
			expected:   "/proxied.builder.ImageBuilder/Build",
		},
		{
			name:       "service with multiple dots",
			prefix:     "proxied",
			fullMethod: "/service.Package.SubService/Method",
			expected:   "/proxied.service.Package.SubService/Method",
		},
		{
			name:       "complex service name",
			prefix:     "proxied",
			fullMethod: "/gitpod.v1.WorkspaceService/CreateWorkspace",
			expected:   "/proxied.gitpod.v1.WorkspaceService/CreateWorkspace",
		},
		{
			name:       "prefix with slashes gets cleaned",
			prefix:     "/proxied/",
			fullMethod: "/builder.ImageBuilder/Build",
			expected:   "/proxied.builder.ImageBuilder/Build",
		},
		{
			name:       "different prefix",
			prefix:     "intercepted",
			fullMethod: "/auth.AuthService/Login",
			expected:   "/intercepted.auth.AuthService/Login",
		},

		// Edge cases - empty/invalid inputs
		{
			name:       "empty prefix",
			prefix:     "",
			fullMethod: "/builder.ImageBuilder/Build",
			expected:   "/builder.ImageBuilder/Build",
		},
		{
			name:       "empty fullMethod",
			prefix:     "proxied",
			fullMethod: "",
			expected:   "",
		},
		{
			name:       "both empty",
			prefix:     "",
			fullMethod: "",
			expected:   "",
		},

		// Edge cases - malformed inputs
		{
			name:       "no leading slash",
			prefix:     "proxied",
			fullMethod: "builder.ImageBuilder/Build",
			expected:   "builder.ImageBuilder/Build",
		},
		{
			name:       "no dots in method",
			prefix:     "proxied",
			fullMethod: "/service/Method",
			expected:   "/service/Method",
		},
		{
			name:       "just slash",
			prefix:     "proxied",
			fullMethod: "/",
			expected:   "/",
		},
		{
			name:       "slash with no content",
			prefix:     "proxied",
			fullMethod: "/Method",
			expected:   "/Method",
		},

		// Edge cases - dots in unusual positions
		{
			name:       "dot at beginning after slash",
			prefix:     "proxied",
			fullMethod: "/.service/Method",
			expected:   "/proxied..service/Method",
		},
		{
			name:       "multiple consecutive dots",
			prefix:     "proxied",
			fullMethod: "/service..Package/Method",
			expected:   "/proxied.service..Package/Method",
		},
		{
			name:       "dot at end before slash",
			prefix:     "proxied",
			fullMethod: "/service./Method",
			expected:   "/proxied.service./Method",
		},

		// Edge cases - no method part
		{
			name:       "no method part",
			prefix:     "proxied",
			fullMethod: "/service.Package",
			expected:   "/proxied.service.Package",
		},
		{
			name:       "service with dot but no slash separator",
			prefix:     "proxied",
			fullMethod: "/service.Package.Method",
			expected:   "/proxied.service.Package.Method",
		},

		// Edge cases - special characters
		{
			name:       "service with underscores",
			prefix:     "proxied",
			fullMethod: "/image_builder.BuildService/CreateImage",
			expected:   "/proxied.image_builder.BuildService/CreateImage",
		},
		{
			name:       "service with hyphens",
			prefix:     "proxied",
			fullMethod: "/image-builder.BuildService/CreateImage",
			expected:   "/proxied.image-builder.BuildService/CreateImage",
		},
		{
			name:       "service with numbers",
			prefix:     "proxied",
			fullMethod: "/v1.ImageBuilder/Build",
			expected:   "/proxied.v1.ImageBuilder/Build",
		},

		// Edge cases - prefix variations
		{
			name:       "prefix with dots",
			prefix:     "proxy.intercepted",
			fullMethod: "/builder.ImageBuilder/Build",
			expected:   "/proxy.intercepted.builder.ImageBuilder/Build",
		},
		{
			name:       "prefix with underscores",
			prefix:     "proxy_intercepted",
			fullMethod: "/builder.ImageBuilder/Build",
			expected:   "/proxy_intercepted.builder.ImageBuilder/Build",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &ServiceNamePrefixerInterceptor{
				Prefix: tt.prefix,
			}
			result := s.prefixServiceName(tt.fullMethod)
			if result != tt.expected {
				t.Errorf("prefixServiceName() = %q, expected %q", result, tt.expected)
			}
		})
	}
}

func TestServiceNamePrefixerInterceptor_prefixServiceName_Examples(t *testing.T) {
	// Additional focused tests for the specific example mentioned in the task
	s := &ServiceNamePrefixerInterceptor{
		Prefix: "proxied",
	}

	// Test the exact transformation mentioned in the task
	input := "/builder.ImageBuilder/Build"
	expected := "/proxied.builder.ImageBuilder/Build"
	result := s.prefixServiceName(input)

	if result != expected {
		t.Errorf("Expected transformation %q -> %q, but got %q", input, expected, result)
	}

	// Test that the first dot is used as anchor
	input2 := "/first.second.third/Method"
	expected2 := "/proxied.first.second.third/Method"
	result2 := s.prefixServiceName(input2)

	if result2 != expected2 {
		t.Errorf("Expected first dot as anchor %q -> %q, but got %q", input2, expected2, result2)
	}
}
