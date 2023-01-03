// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package grpc

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/apipb"
	"google.golang.org/protobuf/types/known/sourcecontextpb"
)

func TestGetFieldValue(t *testing.T) {
	type Expectation struct {
		Found bool
		Val   string
	}
	tests := []struct {
		Name        string
		Message     proto.Message
		Path        string
		Expectation Expectation
	}{
		{
			Name:        "direct access",
			Message:     &apipb.Api{Name: "bar"},
			Path:        "name",
			Expectation: Expectation{Found: true, Val: "bar"},
		},
		{
			Name:        "empty field",
			Message:     &apipb.Api{},
			Path:        "name",
			Expectation: Expectation{Found: true},
		},
		{
			Name:        "non-existent field",
			Message:     &apipb.Api{},
			Path:        "does-not-exist",
			Expectation: Expectation{Found: false},
		},
		{
			Name: "nest struct",
			Message: &apipb.Api{
				SourceContext: &sourcecontextpb.SourceContext{
					FileName: "bar",
				},
			},
			Path:        "source_context.file_name",
			Expectation: Expectation{Found: true, Val: "bar"},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation
			act.Val, act.Found = getFieldValue(test.Message.ProtoReflect(), strings.Split(test.Path, "."))
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected getFieldValue (-want +got):\n%s", diff)
			}
		})
	}
}

func BenchmarkGetFieldValue(b *testing.B) {
	msg := apipb.Api{
		SourceContext: &sourcecontextpb.SourceContext{
			FileName: "bar",
		},
	}
	msgr := msg.ProtoReflect()
	path := []string{"source_context", "file_name"}
	// run the Fib function b.N times
	for n := 0; n < b.N; n++ {
		getFieldValue(msgr, path)
	}
}
