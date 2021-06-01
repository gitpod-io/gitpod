// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	_ "embed"
	"strconv"
	"time"

	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	appapi "github.com/gitpod-io/gitpod/local-app/api"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/bastion"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/sirupsen/logrus"
	cli "github.com/urfave/cli/v2"
	keyring "github.com/zalando/go-keyring"
	"google.golang.org/grpc"
)

var (
	// Version : current version
	Version string = strings.TrimSpace(version)
	//go:embed version.txt
	version string
)

func main() {
	app := cli.App{
		Name:                 "gitpod-local-companion",
		Usage:                "connect your Gitpod workspaces",
		Action:               DefaultCommand("run"),
		EnableBashCompletion: true,
		Version:              Version,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "gitpod-host",
				Usage: "URL of the Gitpod installation to connect to",
				EnvVars: []string{
					"GITPOD_HOST",
				},
				Value: "https://gitpod.io",
			},
			&cli.BoolFlag{
				Name:  "mock-keyring",
				Usage: "Don't use system native keyring, but store Gitpod token in memory",
			},
			&cli.BoolFlag{
				Name:  "allow-cors-from-port",
				Usage: "Allow CORS requests from workspace port location",
			},
			&cli.IntFlag{
				Name:  "api-port",
				Usage: "Local App API endpoint's port",
				Value: 63100,
			},
		},
		Commands: []*cli.Command{
			{
				Name: "run",
				Action: func(c *cli.Context) error {
					if c.Bool("mock-keyring") {
						keyring.MockInit()
					}
					return run(c.String("gitpod-host"), c.String("ssh_config"), c.Int("api-port"), c.Bool("allow-cors-from-port"))
				},
				Flags: []cli.Flag{
					&cli.PathFlag{
						Name:  "ssh_config",
						Usage: "produce and update an OpenSSH compatible ssh_config file",
						Value: "/tmp/gitpod_ssh_config",
					},
				},
			},
		},
	}
	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}

func DefaultCommand(name string) cli.ActionFunc {
	return func(ctx *cli.Context) error {
		return ctx.App.Command(name).Run(ctx)
	}
}

func run(origin, sshConfig string, apiPort int, allowCORSFromPort bool) error {
	// Trailing slash(es) result in connection issues, so remove them preemptively
	origin = strings.TrimRight(origin, "/")
	tkn, err := auth.GetToken(origin)
	if errors.Is(err, keyring.ErrNotFound) {
		tkn, err = auth.Login(context.Background(), auth.LoginOpts{GitpodURL: origin})
		if tkn != "" {
			err = auth.SetToken(origin, tkn)
			if err != nil {
				logrus.WithField("origin", origin).Warnf("could not write token to keyring: %s", err)
				// Allow to continue
				err = nil
			}
		}
	}
	if err != nil {
		return err
	}

	originURL, err := url.Parse(origin)
	if err != nil {
		return err
	}
	wsHostRegex := "(\\.[^.]+)\\." + strings.ReplaceAll(originURL.Host, ".", "\\.")
	wsHostRegex = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8})" + wsHostRegex
	if allowCORSFromPort {
		wsHostRegex = "([0-9]+)-" + wsHostRegex
	}
	hostRegex, err := regexp.Compile("^" + wsHostRegex)
	if err != nil {
		return err
	}

	cb := bastion.CompositeCallbacks{
		&logCallbacks{},
	}
	if sshConfig != "" {
		cb = append(cb, &bastion.SSHConfigWritingCallback{Path: sshConfig})
	}

	var b *bastion.Bastion

	wshost := origin
	wshost = strings.ReplaceAll(wshost, "https://", "wss://")
	wshost = strings.ReplaceAll(wshost, "http://", "ws://")
	wshost += "/api/v1"
	client, err := gitpod.ConnectToServer(wshost, gitpod.ConnectToServerOpts{
		Context: context.Background(),
		Token:   tkn,
		Log:     logrus.NewEntry(logrus.New()),
		ReconnectionHandler: func() {
			if b != nil {
				b.FullUpdate()
			}
		},
	})
	if err != nil {
		return err
	}

	b = bastion.New(client, cb)
	grpcServer := grpc.NewServer()
	appapi.RegisterLocalAppServer(grpcServer, bastion.NewLocalAppService(b))
	allowOrigin := func(origin string) bool {
		// Is the origin a subdomain of the installations hostname?
		return hostRegex.Match([]byte(origin))
	}
	go http.ListenAndServe("localhost:"+strconv.Itoa(apiPort), grpcweb.WrapServer(grpcServer,
		grpcweb.WithCorsForRegisteredEndpointsOnly(false),
		grpcweb.WithOriginFunc(allowOrigin),
		grpcweb.WithWebsockets(true),
		grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool {
			origin, err := grpcweb.WebsocketRequestOrigin(req)
			if err != nil {
				return false
			}
			return allowOrigin(origin)
		}),
		grpcweb.WithWebsocketPingInterval(15*time.Second),
	))
	defer grpcServer.Stop()
	return b.Run()
}

type logCallbacks struct{}

func (*logCallbacks) InstanceUpdate(w *bastion.Workspace) {
	logrus.WithField("workspace", w).Info("instance update")
}
