// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package grpc

import (
	"strconv"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/apipb"
	"google.golang.org/protobuf/types/known/sourcecontextpb"
	"google.golang.org/protobuf/types/known/typepb"
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
			Name:        "empty string field",
			Message:     &apipb.Api{},
			Path:        "name",
			Expectation: Expectation{Found: true},
		},
		{
			Name:        "enum field",
			Message:     &apipb.Api{Syntax: typepb.Syntax_SYNTAX_PROTO3},
			Path:        "syntax",
			Expectation: Expectation{Found: true, Val: strconv.Itoa(int(typepb.Syntax_SYNTAX_PROTO3))},
		},
		{
			Name:        "empty enum field",
			Message:     &apipb.Api{},
			Path:        "syntax",
			Expectation: Expectation{Found: true, Val: "0"},
		},
		{
			Name:        "bool field",
			Message:     &apipb.Method{RequestStreaming: true},
			Path:        "request_streaming",
			Expectation: Expectation{Found: true, Val: "t"},
		},
		{
			Name:        "empty bool field",
			Message:     &apipb.Method{},
			Path:        "request_streaming",
			Expectation: Expectation{Found: true, Val: "f"},
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

func TestFieldAccessKey(t *testing.T) {
	type Expectation struct {
		Val string
		Err error
	}
	tests := []struct {
		Name        string
		Message     proto.Message
		Key         string
		Expectation Expectation
	}{
		{
			Name: "composite key",
			Message: &apipb.Api{
				SourceContext: &sourcecontextpb.SourceContext{
					FileName: "bar",
				},
				Syntax: typepb.Syntax_SYNTAX_PROTO3,
			},
			Key:         "source_context.file_name,syntax",
			Expectation: Expectation{Val: "|bar|1", Err: nil},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation
			keyFn := fieldAccessKey(test.Key)
			act.Val, act.Err = keyFn(test.Message)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected fieldAccessKey (-want +got):\n%s", diff)
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

func BenchmarkFieldAccessKey_String(b *testing.B) {
	msg := &apipb.Api{
		Name: "bar",
	}
	keyFn := fieldAccessKey("name")
	for n := 0; n < b.N; n++ {
		if _, err := keyFn(msg); err != nil {
			b.Logf("failed to access key: %v", err)
			b.Fail()
		}
	}
}

func BenchmarkFieldAccessKey_Enum(b *testing.B) {
	msg := &apipb.Api{
		Syntax: typepb.Syntax_SYNTAX_PROTO3,
	}
	keyFn := fieldAccessKey("syntax")
	for n := 0; n < b.N; n++ {
		if _, err := keyFn(msg); err != nil {
			b.Logf("failed to access key: %v", err)
			b.Fail()
		}
	}
}

func BenchmarkFieldAccessKey_Bool(b *testing.B) {
	msg := &apipb.Method{
		RequestStreaming: true,
	}
	keyFn := fieldAccessKey("request_streaming")
	for n := 0; n < b.N; n++ {
		if _, err := keyFn(msg); err != nil {
			b.Logf("failed to access key: %v", err)
			b.Fail()
		}
	}
}

func BenchmarkFieldAccessKey_Composite(b *testing.B) {
	msg := &apipb.Method{
		Name:             "bar",
		RequestStreaming: true,
	}
	keyFn := fieldAccessKey("name,request_streaming")
	for n := 0; n < b.N; n++ {
		if _, err := keyFn(msg); err != nil {
			b.Logf("failed to access key: %v", err)
			b.Fail()
		}
	}
}
