// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	_ "embed"

	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/bastion"
	"github.com/gorilla/handlers"
	"github.com/sirupsen/logrus"
	cli "github.com/urfave/cli/v2"
	keyring "github.com/zalando/go-keyring"
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
			},
			&cli.BoolFlag{
				Name:  "mock-keyring",
				Usage: "Don't use system native keyring, but store Gitpod token in memory",
			},
			&cli.BoolFlag{
				Name:  "allow-cors-from-port",
				Usage: "Allow CORS requests from workspace port location",
			},
		},
		Commands: []*cli.Command{
			{
				Name: "run",
				Action: func(c *cli.Context) error {
					if c.Bool("mock-keyring") {
						keyring.MockInit()
					}
					return run(c.String("gitpod-host"), c.String("ssh_config"), c.Bool("allow-cors-from-port"))
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

func run(origin, sshConfig string, allowCORSFromPort bool) error {
	tkn, err := auth.GetToken(origin)
	if errors.Is(err, keyring.ErrNotFound) {
		tkn, err = auth.Login(context.Background(), auth.LoginOpts{GitpodURL: origin})
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
	go http.ListenAndServe("localhost:5000", handlers.CORS(
		handlers.AllowedOriginValidator(func(origin string) bool {
			url, err := url.Parse(origin)
			if err != nil {
				return false
			}
			// Is the origin a subdomain of the installations hostname?
			matches := hostRegex.Match([]byte(url.Host))
			return matches
		}),
	)(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		segs := strings.Split(r.URL.Path, "/")
		if len(segs) < 3 {
			http.Error(rw, "invalid URL Path", http.StatusBadRequest)
			return
		}
		worksapceID := segs[1]
		port, err := strconv.Atoi(segs[2])
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}
		localAddr, err := b.GetTunnelLocalAddr(worksapceID, uint32(port))
		if err != nil {
			http.Error(rw, err.Error(), http.StatusNotFound)
			return
		}
		fmt.Fprintf(rw, localAddr)
	})))
	return b.Run()
}

type logCallbacks struct{}

func (*logCallbacks) InstanceUpdate(w *bastion.Workspace) {
	logrus.WithField("workspace", w).Info("instance update")
}
