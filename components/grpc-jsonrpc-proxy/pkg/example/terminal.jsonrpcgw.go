package example

import (
	"fmt"

	proxy "github.com/gitpod/gitpod-io/grpc-jsonrpc-proxy/pkg/proxy"
	"github.com/golang/protobuf/proto"
	context "golang.org/x/net/context"
	"google.golang.org/grpc"

	pb "github.com/gitpod-io/gitpod/supervisor/api"
)

func init() {
	proxy.RegisterService("TerminalService", &TerminalService{})
}

type TerminalService struct{}

func (t *TerminalService) HandlerMap() map[string]proxy.MethodHandler {
	m := make(map[string]proxy.MethodHandler)
	m["open"] = proxy.MakeUnaryHandler(t.Open, func() proto.Message { return new(pb.OpenTerminalRequest) })
	m["list"] = proxy.MakeUnaryHandler(t.List, func() proto.Message { return new(pb.ListTerminalsRequest) })
	m["listen"] = proxy.MakeStreamingHandler(t.Listen, func() proto.Message { return new(pb.ListenTerminalRequest) })
	m["write"] = proxy.MakeUnaryHandler(t.Write, func() proto.Message { return new(pb.WriteTerminalRequest) })
	m["setSize"] = proxy.MakeUnaryHandler(t.SetSize, func() proto.Message { return new(pb.SetTerminalSizeRequest) })
	return m
}

func (t *TerminalService) Open(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message) (proto.Message, error) {
	req, ok := in.(*pb.OpenTerminalRequest)
	if !ok {
		return nil, fmt.Errorf("input is not of type *pb.OpenTerminalRequest")
	}

	client := pb.NewTerminalServiceClient(conn)
	return client.Open(ctx, req)
}

func (t *TerminalService) List(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message) (proto.Message, error) {
	req, ok := in.(*pb.ListTerminalsRequest)
	if !ok {
		return nil, fmt.Errorf("input is not of type *pb.ListTerminalsRequest")
	}

	client := pb.NewTerminalServiceClient(conn)
	return client.List(ctx, req)
}

func (t *TerminalService) Listen(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message, out func(proto.Message) error) error {
	req, ok := in.(*pb.ListenTerminalRequest)
	if !ok {
		return fmt.Errorf("input is not of type *pb.ListenTerminalRequest")
	}

	client := pb.NewTerminalServiceClient(conn)
	inc, err := client.Listen(ctx, req)
	if err != nil {
		return err
	}
	for {
		msg, err := inc.Recv()
		if err != nil {
			return err
		}

		err = out(msg)
		if err != nil {
			return err
		}
	}
}

func (t *TerminalService) Write(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message) (proto.Message, error) {
	req, ok := in.(*pb.WriteTerminalRequest)
	if !ok {
		return nil, fmt.Errorf("input is not of type *pb.WriteTerminalRequest")
	}

	client := pb.NewTerminalServiceClient(conn)
	return client.Write(ctx, req)
}

func (t *TerminalService) SetSize(ctx context.Context, conn grpc.ClientConnInterface, in proto.Message) (proto.Message, error) {
	req, ok := in.(*pb.SetTerminalSizeRequest)
	if !ok {
		return nil, fmt.Errorf("input is not of type *pb.SetTerminalSizeRequest")
	}

	client := pb.NewTerminalServiceClient(conn)
	return client.SetSize(ctx, req)
}
