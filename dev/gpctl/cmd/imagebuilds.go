// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"net"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"k8s.io/client-go/kubernetes"

	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
	"github.com/gitpod-io/gitpod/image-builder/api"
)

// imagebuildsCmd represents the client command
var imagebuildsCmd = &cobra.Command{
	Use:   "imagebuilds",
	Short: "Controls and inspects workspace Docker image builds",
	Args:  cobra.ExactArgs(1),
}

func init() {
	imagebuildsCmd.PersistentFlags().StringP("tls", "t", "", "TLS certificate when connecting to a secured gRPC endpoint")
	imagebuildsCmd.PersistentFlags().Bool("mk3", true, "use image-builder mk3")

	rootCmd.AddCommand(imagebuildsCmd)
}

func getImagebuildsClient(ctx context.Context) (*grpc.ClientConn, api.ImageBuilderClient, error) {
	cfg, namespace, err := getKubeconfig()
	if err != nil {
		return nil, nil, err
	}
	clientSet, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, nil, err
	}

	comp := "image-builder"
	if mk3, _ := imagebuildsCmd.PersistentFlags().GetBool("mk3"); mk3 {
		comp = "image-builder-mk3"
	}

	freePort, err := GetFreePort()
	if err != nil {
		return nil, nil, err
	}

	port := fmt.Sprintf("%d:8080", freePort)
	podName, err := util.FindAnyPodForComponent(clientSet, namespace, comp)
	if err != nil {
		return nil, nil, err
	}
	readychan, errchan := util.ForwardPort(ctx, cfg, namespace, podName, port)
	select {
	case <-readychan:
	case err := <-errchan:
		return nil, nil, err
	case <-ctx.Done():
		return nil, nil, ctx.Err()
	}

	secopt := grpc.WithInsecure()
	cert, _ := workspacesCmd.Flags().GetString("tls")
	if cert != "" {
		creds, err := credentials.NewClientTLSFromFile(cert, "")
		if err != nil {
			return nil, nil, xerrors.Errorf("could not load tls cert: %w", err)
		}

		secopt = grpc.WithTransportCredentials(creds)
	}

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", freePort), secopt, util.WithClientUnaryInterceptor())
	if err != nil {
		return nil, nil, err
	}
	return conn, api.NewImageBuilderClient(conn), nil
}

func GetFreePort() (port int, err error) {
	var a *net.TCPAddr
	if a, err = net.ResolveTCPAddr("tcp", "localhost:0"); err == nil {
		var l *net.TCPListener
		if l, err = net.ListenTCP("tcp", a); err == nil {
			defer l.Close()
			return l.Addr().(*net.TCPAddr).Port, nil
		}
	}
	return
}
