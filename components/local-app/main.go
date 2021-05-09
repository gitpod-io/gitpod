// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// package main

// import (
// 	"context"
// 	"errors"
// 	"log"
// 	"os"
// 	"strings"

// 	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
// 	"github.com/gitpod-io/local-app/pkg/auth"
// 	"github.com/gitpod-io/local-app/pkg/bastion"
// 	"github.com/sirupsen/logrus"
// 	"github.com/urfave/cli/v2"
// 	"github.com/zalando/go-keyring"
// )

// func main() {
// 	app := cli.App{
// 		Name:                 "gitpod",
// 		Action:               DefaultCommand("run"),
// 		EnableBashCompletion: true,
// 		Flags: []cli.Flag{
// 			&cli.StringFlag{
// 				Name:  "gitpod-host",
// 				Usage: "URL of the Gitpod installation to connect to",
// 				EnvVars: []string{
// 					"GITPOD_HOST",
// 				},
// 			},
// 			&cli.BoolFlag{
// 				Name:  "mock-keyring",
// 				Usage: "Don't use system native keyring, but store Gitpod token in memory",
// 			},
// 		},
// 		Commands: []*cli.Command{
// 			{
// 				Name: "run",
// 				Action: func(c *cli.Context) error {
// 					if c.Bool("mock-keyring") {
// 						keyring.MockInit()
// 					}
// 					return run(c.String("gitpod-host"), c.String("ssh_config"))
// 				},
// 				Flags: []cli.Flag{
// 					&cli.PathFlag{
// 						Name:  "ssh_config",
// 						Usage: "produce and update an OpenSSH compatible ssh_config file",
// 						Value: "/tmp/gitpod_ssh_config",
// 					},
// 				},
// 			},
// 		},
// 	}
// 	err := app.Run(os.Args)
// 	if err != nil {
// 		log.Fatal(err)
// 	}
// }

// func DefaultCommand(name string) cli.ActionFunc {
// 	return func(ctx *cli.Context) error {
// 		return ctx.App.Command(name).Run(ctx)
// 	}
// }

// func run(host, sshConfig string) error {
// 	tkn, err := auth.GetToken(host)
// 	if errors.Is(err, keyring.ErrNotFound) {
// 		tkn, err = auth.Login(context.Background(), auth.LoginOpts{GitpodURL: host})
// 	}
// 	if err != nil {
// 		return err
// 	}

// 	cb := bastion.CompositeCallbacks{
// 		&logCallbacks{},
// 	}
// 	if sshConfig != "" {
// 		cb = append(cb, &bastion.SSHConfigWritingCallback{Path: sshConfig})
// 	}

// 	wshost := host
// 	wshost = strings.ReplaceAll(wshost, "https://", "wss://")
// 	wshost = strings.ReplaceAll(wshost, "http://", "ws://")
// 	wshost += "/api/v1"
// 	client, err := gitpod.ConnectToServer(wshost, gitpod.ConnectToServerOpts{
// 		Context: context.Background(),
// 		Token:   tkn,
// 		Log:     logrus.NewEntry(logrus.New()),
// 	})
// 	if err != nil {
// 		return err
// 	}
// 	b := bastion.New(client, cb)
// 	return b.Run()
// }

// type logCallbacks struct{}

// func (*logCallbacks) InstanceUpdate(w *bastion.Workspace) {
// 	logrus.WithField("workspace", w).Info("instance update")
// }

package main

import (
	// "context"
	"context"
	"fmt"
	"log"
	"net"
	"net/http"

	// "log"
	"os"

	"github.com/skratchdot/open-golang/open"
	"golang.org/x/oauth2"
)

func main() {
	ctx := context.Background()

	rl, err := net.Listen("tcp", "localhost:64110")
	if err != nil {
		fmt.Printf("snap: can't listen: %s\n", err)
		os.Exit(1)
	}
	defer rl.Close()

	var (
		ec = make(chan error, 1)
		tc = make(chan string, 1)
	)

	returnHandler := func(rw http.ResponseWriter, req *http.Request) {
		tc <- req.URL.Query().Get("ots")
	}

	returnServer := &http.Server{
		Addr:    "localhost:0",
		Handler: http.HandlerFunc(returnHandler),
	}
	go func() {
		err := returnServer.Serve(rl)
		if err != nil {
			ec <- err
		}
	}()
	defer returnServer.Shutdown(ctx)

	conf := &oauth2.Config{
		ClientID: "gplctl-1.0",
		ClientSecret: "gplctl-secret", // Required (even though it is marked as optional?!)
		Scopes: []string{"function:getWorkspace"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://rl-gplctl-oauth2-server.staging.gitpod-dev.com/api/local-app/authorize",
			TokenURL: "https://rl-gplctl-oauth2-server.staging.gitpod-dev.com/api/local-app/token",
		},
	}
	responseTypeParam := oauth2.SetAuthURLParam("response_type", "code")
	redirectURIParam := oauth2.SetAuthURLParam("redirect_uri", fmt.Sprintf("http://localhost:%d", rl.Addr().(*net.TCPAddr).Port))
	codeChallengeMethodParam := oauth2.SetAuthURLParam("code_challenge_method", "S256")
	codeChallengeParam := oauth2.SetAuthURLParam("code_challenge", "cNerW3ccX3K10Yp5LJMSAT8ehENHcNILeGKmEbaL2pI")

	// Redirect user to consent page to ask for permission
	// for the scopes specified above.
	authorizationURL := conf.AuthCodeURL("state", responseTypeParam, redirectURIParam, codeChallengeParam, codeChallengeMethodParam)
	fmt.Printf("URL for the auth: %v", authorizationURL)

	// open a browser window to the authorizationURL
	err = open.Start(authorizationURL)
	if err != nil {
		fmt.Printf("snap: can't open browser to URL %s: %s\n", authorizationURL, err)
		os.Exit(1)
	}

	var response string
	select {
	case <-ctx.Done():
		fmt.Printf("DONE: %v", ctx.Err())
		os.Exit(1)
	case err = <-ec:
		fmt.Printf("ERR: %v", err)
		os.Exit(1)
	case response = <-tc:
	}
	fmt.Printf("response: %s\n", response)

	// Use the authorization code that is pushed to the redirect
	// URL. Exchange will do the handshake to retrieve the
	// initial access token. The HTTP Client returned by
	// conf.Client will refresh the token as necessary.
	// 	var code string
	// 	if _, err := fmt.Scan(&code); err != nil {
	// 		log.Fatal(err)
	// 	}
	tok, err := conf.Exchange(ctx, response)
	if err != nil {
		log.Fatal(err)
	}

	client := conf.Client(ctx, tok)
	client.Get("...")
}
