// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/bastion"
	"github.com/sirupsen/logrus"
	"github.com/urfave/cli/v2"
	"github.com/zalando/go-keyring"
)

func main() {
	app := cli.App{
		Name: "local-app-debug",
		Commands: []*cli.Command{
			{
				Name: "login",
				Action: func(c *cli.Context) error {
					keyring.MockInit()
					_, err := auth.Login(context.Background(), auth.LoginOpts{
						GitpodURL: c.String("gitpod-host"),
					})
					if err != nil {
						return err
					}
					fmt.Println("login successful")
					return nil
				},
				Flags: []cli.Flag{
					&cli.StringFlag{
						EnvVars: []string{
							"GITPOD_HOST",
						},
						Name: "gitpod-host",
					},
				},
			},
			{
				Name: "run",
				Action: func(c *cli.Context) error {
					if c.Bool("mock-keyring") {
						keyring.MockInit()
					}
					return run(c.String("gitpod-host"), c.String("token"), c.String("ssh_config"))
				},
				Flags: []cli.Flag{
					&cli.StringFlag{
						EnvVars: []string{
							"GITPOD_HOST",
						},
						Name: "gitpod-host",
					},
					&cli.StringFlag{
						Name: "token",
						EnvVars: []string{
							"GITPOD_TOKEN",
						},
					},
					&cli.PathFlag{
						Name: "ssh_config",
					},
					&cli.BoolFlag{
						Name: "mock-keyring",
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

func run(host, token, sshConfig string) error {
	if token != "" {
		auth.SetToken(host, token)
	}

	tkn, err := auth.GetToken(host)
	if errors.Is(err, keyring.ErrNotFound) {
		tkn, err = auth.Login(context.Background(), auth.LoginOpts{GitpodURL: host})
	}
	if err != nil {
		return err
	}

	cb := bastion.CompositeCallbacks{
		&logCallbacks{},
	}
	if sshConfig != "" {
		cb = append(cb, &bastion.SSHConfigWritingCallback{Path: sshConfig})
	}

	wshost := host
	wshost = strings.ReplaceAll(wshost, "https://", "wss://")
	wshost = strings.ReplaceAll(wshost, "http://", "ws://")
	wshost += "/api/v1"
	client, err := gitpod.ConnectToServer(wshost, gitpod.ConnectToServerOpts{
		Context: context.Background(),
		Token:   tkn,
		Log:     logrus.NewEntry(logrus.New()),
	})
	if err != nil {
		return err
	}
	b := bastion.New(client, cb)
	return b.Run()
}

type logCallbacks struct{}

func (*logCallbacks) InstanceUpdate(w *bastion.Workspace) {
	logrus.WithField("workspace", w).Info("instance update")
}
