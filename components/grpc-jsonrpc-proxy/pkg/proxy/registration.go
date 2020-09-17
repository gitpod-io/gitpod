package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/golang/protobuf/jsonpb"
	"github.com/golang/protobuf/proto"
	"github.com/sourcegraph/jsonrpc2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/status"
)

var (
	marshaler   = &jsonpb.Marshaler{EnumsAsInts: true, EmitDefaults: true}
	unmarshaler = &jsonpb.Unmarshaler{}

	_services = make(map[string]ServiceProxy)
)

// NewMessageFunc produces a new protobuf message
type NewMessageFunc func() proto.Message

// UnaryJSONRPCHandlerFunc handles unary JSON RPC calls
type UnaryJSONRPCHandlerFunc func(ctx context.Context, conn grpc.ClientConnInterface, in json.RawMessage) (json.RawMessage, error)

// UnaryGRPCHandlerFunc handles unary gRPC calls
type UnaryGRPCHandlerFunc func(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message) (proto.Message, error)

// StreamingJSONRPCHandlerFunc handles server-side streaming JSON RPC calls
type StreamingJSONRPCHandlerFunc func(ctx context.Context, conn grpc.ClientConnInterface, in json.RawMessage, out func(json.RawMessage) error) error

// StreamingGRPCHandlerFunc handles server-side streaming gRPC calls
type StreamingGRPCHandlerFunc func(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message, out func(proto.Message) error) error

// MethodHandler handles a method
type MethodHandler struct {
	Unary  UnaryJSONRPCHandlerFunc
	Stream StreamingJSONRPCHandlerFunc
}

// ServiceProxy proxies a gRPC service
type ServiceProxy interface {
	HandlerMap() map[string]MethodHandler
}

// RegisterService registers a new service proxy
func RegisterService(name string, srv ServiceProxy) {
	_services[name] = srv
}

// MakeUnaryHandler transforms a unary gRPC handler into a MethodHandler
func MakeUnaryHandler(h UnaryGRPCHandlerFunc, inpt NewMessageFunc) MethodHandler {
	return MethodHandler{
		Unary: func(ctx context.Context, conn grpc.ClientConnInterface, jsonIn json.RawMessage) (json.RawMessage, error) {
			in := inpt()
			err := unmarshaler.Unmarshal(bytes.NewReader(jsonIn), in)
			if err != nil {
				return nil, &jsonrpc2.Error{
					Code:    jsonrpc2.CodeInvalidRequest,
					Message: fmt.Sprintf("cannot unmarshal params: %q", err),
				}
			}

			res, err := h(ctx, conn, in)
			if err != nil {
				var msg string
				if s := status.Convert(err); s != nil {
					msg = s.Message()
				}

				return nil, &jsonrpc2.Error{
					Code:    int64(status.Code(err)),
					Message: msg,
				}
			}

			jsonRes, err := marshaler.MarshalToString(res)
			if err != nil {
				if err != nil {
					return nil, &jsonrpc2.Error{
						Code:    jsonrpc2.CodeInternalError,
						Message: fmt.Sprintf("cannot marshal response: %q", err),
					}
				}
			}
			return json.RawMessage(jsonRes), nil
		},
	}
}

// MakeStreamingHandler transforms a streaming gRPC handler into a MethodHandler
func MakeStreamingHandler(h StreamingGRPCHandlerFunc, inpt NewMessageFunc) MethodHandler {
	return MethodHandler{
		Stream: func(ctx context.Context, conn grpc.ClientConnInterface, jsonIn json.RawMessage, jsonOut func(json.RawMessage) error) error {
			in := inpt()
			err := unmarshaler.Unmarshal(bytes.NewReader(jsonIn), in)
			if err != nil {
				return &jsonrpc2.Error{
					Code:    jsonrpc2.CodeInvalidRequest,
					Message: fmt.Sprintf("cannot unmarshal params: %q", err),
				}
			}

			out := func(msg proto.Message) error {
				jsonRes, err := marshaler.MarshalToString(msg)
				if err != nil {
					if err != nil {
						return &jsonrpc2.Error{
							Code:    jsonrpc2.CodeInternalError,
							Message: fmt.Sprintf("cannot marshal response: %q", err),
						}
					}
				}
				return jsonOut(json.RawMessage(jsonRes))
			}

			err = h(ctx, conn, in, out)
			if err != nil {
				var msg string
				if s := status.Convert(err); s != nil {
					msg = s.Message()
				}

				return &jsonrpc2.Error{
					Code:    int64(status.Code(err)),
					Message: msg,
				}
			}

			return nil
		},
	}
}
