// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net"
	"path/filepath"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
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
	imagebuildsCmd.PersistentFlags().String("host", "", "dial a host directly")
	imagebuildsCmd.PersistentFlags().String("tls-path", "", "TLS certificate when connecting to a secured gRPC endpoint")

	rootCmd.AddCommand(imagebuildsCmd)
}

func getImagebuildsClient(ctx context.Context) (*grpc.ClientConn, api.ImageBuilderClient, error) {
	host, _ := imagebuildsCmd.PersistentFlags().GetString("host")
	if host == "" {
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
		host = fmt.Sprintf("localhost:%d", freePort)
	}

	secopt := grpc.WithTransportCredentials(insecure.NewCredentials())
	cert, _ := imagebuildsCmd.Flags().GetString("tls")
	if cert != "" {
		creds, err := credentials.NewClientTLSFromFile(cert, "")
		if err != nil {
			return nil, nil, xerrors.Errorf("could not load tls cert: %w", err)
		}

		secopt = grpc.WithTransportCredentials(creds)
	} else if fn, _ := imagebuildsCmd.Flags().GetString("tls-path"); fn != "" {
		crt, err := ioutil.ReadFile(filepath.Join(fn, "tls.crt"))
		if err != nil {
			return nil, nil, err
		}
		key, err := ioutil.ReadFile(filepath.Join(fn, "tls.key"))
		if err != nil {
			return nil, nil, err
		}
		cert, err := tls.X509KeyPair(crt, key)
		if err != nil {
			return nil, nil, err
		}

		ca, err := ioutil.ReadFile(filepath.Join(fn, "ca.crt"))
		if err != nil {
			return nil, nil, err
		}
		certPool := x509.NewCertPool()
		certPool.AppendCertsFromPEM(ca)

		creds := credentials.NewTLS(&tls.Config{
			Certificates: []tls.Certificate{cert},
			RootCAs:      certPool,
			ServerName:   "ws-manager",
		})
		if err != nil {
			return nil, nil, xerrors.Errorf("could not load tls cert: %w", err)
		}

		secopt = grpc.WithTransportCredentials(creds)
	}

	conn, err := grpc.Dial(host, secopt, util.WithClientUnaryInterceptor())
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
