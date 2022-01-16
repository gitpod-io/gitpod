// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"net"

	_ "embed"

	"github.com/gitpod-io/gitpod/installer/api"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
)

var serveOpts struct {
	Addr string
}

// serveCmd represents the render command
var serveCmd = &cobra.Command{
	Use:    "serve",
	Short:  "Starts the installer API server",
	Hidden: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		l, err := net.Listen("tcp", serveOpts.Addr)
		if err != nil {
			return err
		}

		srv := grpc.NewServer()
		api.RegisterInstallerServiceServer(srv, &installerService{})
		reflection.Register(srv)
		fmt.Printf("serving on %s\n", serveOpts.Addr)
		return srv.Serve(l)
	},
}

type installerService struct {
	api.UnimplementedInstallerServiceServer
}

func (*installerService) ValidateConfig(ctx context.Context, req *api.ValidateConfigRequest) (*api.ValidateConfigResponse, error) {
	cfg, version, err := config.Load(req.Config)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, err.Error())
	}
	if version != config.CurrentVersion {
		return nil, status.Errorf(codes.FailedPrecondition, "unsupprted config version: %s", version)
	}
	apiVersion, err := config.LoadConfigVersion(version)
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "unsupported config version %s: %s", version, err.Error())
	}

	val, err := config.Validate(apiVersion, cfg)
	if err != nil {
		return nil, status.Errorf(codes.Internal, err.Error())
	}

	var res api.ValidateConfigResponse
	res.Valid = val.Valid
	res.Errors = val.Fatal
	res.Warnings = val.Warnings
	return &res, nil
}
func (*installerService) ValidateCluster(ctx context.Context, req *api.ValidateClusterRequest) (*api.ValidateClusterRequest, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ValidateCluster not implemented")
}

func (*installerService) InitConfig(context.Context, *api.InitConfigRequest) (*api.InitConfigResponse, error) {
	cfg, err := config.NewDefaultConfig()
	if err != nil {
		return nil, status.Errorf(codes.Internal, err.Error())
	}
	fc, err := config.Marshal(config.CurrentVersion, cfg)
	if err != nil {
		return nil, status.Errorf(codes.Internal, err.Error())
	}
	return &api.InitConfigResponse{Config: fc}, nil
}

func (*installerService) RenderConfig(ctx context.Context, req *api.RenderConfigRequest) (*api.RenderConfigResponse, error) {
	rawCfg, version, err := config.Load(req.Config)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, err.Error())
	}
	if version != config.CurrentVersion {
		return nil, status.Errorf(codes.FailedPrecondition, "unsupprted config version: %s", version)
	}

	res, err := renderKubernetesObjects(version, rawCfg.(*configv1.Config))
	if err != nil {
		return nil, status.Errorf(codes.Internal, err.Error())
	}

	return &api.RenderConfigResponse{Resources: res}, nil
}

func init() {
	rootCmd.AddCommand(serveCmd)

	serveCmd.Flags().StringVarP(&serveOpts.Addr, "addr", "a", "localhost:9999", "address to serve the installer API on")
}
