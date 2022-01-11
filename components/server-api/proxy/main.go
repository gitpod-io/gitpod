package main

import (
	"context"
	"net"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	gp "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/server/api"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"

	lru "github.com/hashicorp/golang-lru"
	"github.com/urfave/cli/v2"
)

func main() {
	log.Init("server-api-proxy", "", true, false)

	app := &cli.App{
		Name:  "server-api-proxy",
		Usage: "proxies the JSON-RPC API of server to the new public API",
		Commands: []*cli.Command{
			{
				Name: "run",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "server-addr",
						Aliases:  []string{"t"},
						Usage:    "address of the server",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "addr",
						Usage:    "address to serve the proxy on",
						Required: true,
					},
				},
				Action: runProxy,
			},
		},
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}

func runProxy(c *cli.Context) error {
	l, err := net.Listen("tcp", c.String("addr"))
	if err != nil {
		return err
	}

	cache, err := lru.New(200)
	if err != nil {
		return err
	}

	srv := grpc.NewServer(grpc.UnaryInterceptor(cachingServerClientInterceptor(c.String("server-addr"), cache)))
	api.RegisterWorkspacesServer(srv, &apiProxy{})
	reflection.Register(srv)
	return srv.Serve(l)
}

var gpclientKey = struct{}{}

func cachingServerClientInterceptor(endpoint string, cache *lru.Cache) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Errorf(codes.Unauthenticated, "missing authorization header")
		}
		authMD, ok := md["authorization"]
		if !ok || len(authMD) < 1 {
			return nil, status.Errorf(codes.Unauthenticated, "missing authorization header")
		}
		auth := authMD[0]

		var client gp.APIInterface
		val, ok := cache.Get(auth)
		if ok {
			client = val.(gp.APIInterface)
		} else {
			client, err = gp.ConnectToServer(endpoint, gp.ConnectToServerOpts{
				Token:   auth,
				Context: context.Background(),
				Log:     log.WithField("client", "client"),
			})
			if err != nil {
				return nil, status.Error(codes.FailedPrecondition, "cannot connect to server")
			}
			cache.Add(auth, client)
		}

		ctx = context.WithValue(ctx, gpclientKey, client)
		return handler(ctx, req)
	}
}

type apiProxy struct {
	api.UnimplementedWorkspacesServer
}

func (proxy *apiProxy) GetWorkspace(ctx context.Context, req *api.GetWorkspaceRequest) (*api.GetWorkspaceResponse, error) {
	client := ctx.Value(gpclientKey).(gp.APIInterface)
	res, err := client.GetWorkspace(ctx, req.Id)
	if err != nil {
		return nil, err
	}

	return &api.GetWorkspaceResponse{
		Workspace: &api.Workspace{
			Id:    res.Workspace.ID,
			Owner: res.Workspace.OwnerID,
		},
	}, nil
}

func (proxy *apiProxy) ListWorkspaces(ctx context.Context, req *api.ListWorkspacesRequest) (*api.ListWorkspacesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListWorkspaces not implemented")
}
func (proxy *apiProxy) CreateWorkspace(ctx context.Context, req *api.CreateWorkspaceRequest) (*api.CreateWorkspaceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreateWorkspace not implemented")
}
func (proxy *apiProxy) StartWorkspace(ctx context.Context, req *api.StartWorkspaceRequest) (*api.StartWorkspaceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method StartWorkspace not implemented")
}
func (proxy *apiProxy) StopWorkspace(ctx context.Context, req *api.StopWorkspaceRequest) (*api.StopWorkspaceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method StopWorkspace not implemented")
}
func (proxy *apiProxy) WatchWorkspacesctx(req *api.WatchWorkspacesRequest, srv api.Workspaces_WatchWorkspacesServer) error {
	return status.Errorf(codes.Unimplemented, "method WatchWorkspaces not implemented")
}
func (proxy *apiProxy) GetWorkspaceInstance(ctx context.Context, req *api.GetWorkspaceInstanceRequest) (*api.GetWorkspaceInstanceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetWorkspaceInstance not implemented")
}
func (proxy *apiProxy) ListWorkspaceInstances(ctx context.Context, req *api.ListWorkspaceInstancesRequest) (*api.ListWorkspaceInstancesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListWorkspaceInstances not implemented")
}
func (proxy *apiProxy) GetRunningWorkspaceInstance(ctx context.Context, req *api.GetRunningWorkspaceInstanceRequest) (*api.GetRunningWorkspaceInstanceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetRunningWorkspaceInstance not implemented")
}
