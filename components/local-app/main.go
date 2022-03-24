// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	_ "embed"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"time"

	"context"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"text/tabwriter"

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
	sshConfig := os.Getenv("GITPOD_LCA_SSH_CONFIG")
	if sshConfig == "" {
		if runtime.GOOS == "windows" {
			sshConfig = filepath.Join(os.TempDir(), "gitpod_ssh_config")
		} else {
			sshConfig = filepath.Join("/tmp", "gitpod_ssh_config")
		}
	}

	app := cli.App{
		Name:                 "gitpod-client",
		Usage:                "Manage gitpod workspaces and run them from your machine",
		Action:               DefaultCommand("ssh-watch"),
		EnableBashCompletion: true,
		Version:              Version,
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "gitpod-host",
				Usage: "URL of the Gitpod installation to connect to",
				Value: "https://mp-gitpod-cli.staging.gitpod-dev.com",
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
				EnvVars: []string{
					"GITPOD_LCA_API_PORT",
				},
				Value: 63100,
			},
			&cli.BoolFlag{
				Name:  "auto-tunnel",
				Usage: "Enable auto tunneling",
				EnvVars: []string{
					"GITPOD_LCA_AUTO_TUNNEL",
				},
				Value: true,
			},
			&cli.StringFlag{
				Name: "auth-redirect-url",
				EnvVars: []string{
					"GITPOD_LCA_AUTH_REDIRECT_URL",
				},
			},
			&cli.BoolFlag{
				Name:  "verbose",
				Usage: "Enable verbose logging",
				EnvVars: []string{
					"GITPOD_LCA_VERBOSE",
				},
				Value: false,
			},
			&cli.DurationFlag{
				Name:  "auth-timeout",
				Usage: "Auth timeout in seconds",
				EnvVars: []string{
					"GITPOD_LCA_AUTH_TIMEOUT",
				},
				Value: 30,
			},
			&cli.StringFlag{
				Name:  "timeout",
				Usage: "How long the local app can run if last workspace was stopped",
				EnvVars: []string{
					"GITPOD_LCA_TIMEOUT",
				},
				Value: "0",
			},
		},
		Commands: []*cli.Command{
			{
				Name: "ssh-watch",
				Action: func(c *cli.Context) error {
					if c.Bool("mock-keyring") {
						keyring.MockInit()
					}
					return run(c.String("gitpod-host"), c.String("ssh_config"), c.Int("api-port"), c.Bool("allow-cors-from-port"),
						c.Bool("auto-tunnel"), c.String("auth-redirect-url"), c.Bool("verbose"), c.Duration("auth-timeout"), c.Duration("timeout"))
				},
				Flags: []cli.Flag{
					&cli.PathFlag{
						Name:  "ssh_config",
						Usage: "produce and update an OpenSSH compatible ssh_config file (defaults to $GITPOD_LCA_SSH_CONFIG)",
						Value: sshConfig,
					},
				},
			},
			{
				Name:    "list",
				Aliases: []string{"ls"},
				Usage:   "Lists all workspaces",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:  "gitpod-host",
						Usage: "URL of the Gitpod installation to connect to",
						Value: "https://mp-gitpod-cli.staging.gitpod-dev.com",
					},
				},
				Action: func(c *cli.Context) error {
					fmt.Println("List Command")
					keyring.MockInit()

					return list(c.Context, startOpts{
						origin:          c.String("gitpod-host"),
						authRedirectUrl: c.String("auth-redirect-url"),
						authTimeout:     c.Duration("auth-timeout"),
					})
				},
			},
			{
				Name:  "start",
				Usage: "Starts a new workspace based on a context-URL",
				Flags: []cli.Flag{
					&cli.BoolFlag{
						Name:  "open-ssh",
						Usage: "Open SSH Connection once the workspace started",
						Value: false,
					},
					&cli.StringFlag{
						Name:  "gitpod-host",
						Usage: "URL of the Gitpod installation to connect to",
						Value: "https://mp-gitpod-cli.staging.gitpod-dev.com",
					},
				},
				Action: func(c *cli.Context) error {

					// if c.Bool("mock-keyring") {
					keyring.MockInit()
					// }

					url := c.Args().Get(0)
					if url == "" {
						return fmt.Errorf("Received empty URL")

					}

					return start(c.Context, startOpts{
						origin:          c.String("gitpod-host"),
						authRedirectUrl: c.String("auth-redirect-url"),
						authTimeout:     c.Duration("auth-timeout"),
						contextURL:      url,
					})
				},
			},
		},
	}
	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}

type startOpts struct {
	origin          string
	authRedirectUrl string
	authTimeout     time.Duration
	contextURL      string
	jumpToSSH       bool
}

func start(ctx context.Context, opts startOpts) error {
	origin := strings.TrimRight(opts.origin, "/")

	client, err := connectToServer(auth.LoginOpts{GitpodURL: origin, RedirectURL: opts.authRedirectUrl, AuthTimeout: opts.authTimeout}, func() {
		fmt.Println("reconnect")
	}, func(err error) {
		fmt.Println("close handler", err)
		// logrus.WithError(closeErr).Error("server connection failed")
		os.Exit(1)
	})
	if err != nil {
		return err
	}

	res, err := client.CreateWorkspace(ctx, &gitpod.CreateWorkspaceOptions{
		ContextURL: opts.contextURL,
	})
	if err != nil {
		logrus.WithError(err).Error("Failed to create a workspace.")
	}

	logrus.Infof("Created a new workspace with ID: %s", res.CreatedWorkspaceID)
	logrus.Infof("You can access your workspace with %s", res.WorkspaceURL)

	// -F /tmp/gitpod_ssh_config <your-workspace-id e.g.apricot-harrier-####>
	cmd := exec.Command("ssh", "-F", "/tmp/gitpod_ssh_config", res.CreatedWorkspaceID)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	time.Sleep(20 * time.Second)
	return cmd.Run()

	// return nil
}

func list(ctx context.Context, opts startOpts) error {
	origin := strings.TrimRight(opts.origin, "/")

	client, err := connectToServer(auth.LoginOpts{GitpodURL: origin, RedirectURL: opts.authRedirectUrl, AuthTimeout: opts.authTimeout}, func() {
		logrus.Info("Reconnect")
	}, func(err error) {
		logrus.WithError(err).Error("Connection to API closed")
		os.Exit(1)
	})
	if err != nil {
		return err
	}

	res, err := client.GetWorkspaces(ctx, &gitpod.GetWorkspacesOptions{})
	if err != nil {
		return err
	}

	var results [][]string
	for _, ws := range res {
		results = append(results, []string{
			ws.Workspace.ID,
			ws.LatestInstance.Status.Phase,
		})
	}

	return printTable(os.Stdout, []string{"Workspace ID", "Phase"}, results)
}

func DefaultCommand(name string) cli.ActionFunc {
	return func(ctx *cli.Context) error {
		return ctx.App.Command(name).Run(ctx)
	}
}

func run(origin, sshConfig string, apiPort int, allowCORSFromPort bool, autoTunnel bool, authRedirectUrl string, verbose bool, authTimeout time.Duration, localAppTimeout time.Duration) error {
	if verbose {
		logrus.SetLevel(logrus.DebugLevel)
	}
	logrus.WithField("ssh_config", sshConfig).Info("writing workspace ssh_config file")

	// Trailing slash(es) result in connection issues, so remove them preemptively
	origin = strings.TrimRight(origin, "/")
	originURL, err := url.Parse(origin)
	if err != nil {
		return err
	}
	wsHostRegex := "(\\.[^.]+)\\." + strings.ReplaceAll(originURL.Host, ".", "\\.")
	wsHostRegex = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8,11})" + wsHostRegex
	if allowCORSFromPort {
		wsHostRegex = "([0-9]+)-" + wsHostRegex
	}
	hostRegex, err := regexp.Compile("^" + wsHostRegex)
	if err != nil {
		return err
	}

	var b *bastion.Bastion

	client, err := connectToServer(auth.LoginOpts{GitpodURL: origin, RedirectURL: authRedirectUrl, AuthTimeout: authTimeout}, func() {
		if b != nil {
			b.FullUpdate()
		}
	}, func(closeErr error) {
		logrus.WithError(closeErr).Error("server connection failed")
		os.Exit(1)
	})
	if err != nil {
		return err
	}

	cb := bastion.CompositeCallbacks{
		&logCallbacks{},
	}
	s := &bastion.SSHConfigWritingCallback{Path: sshConfig}
	if sshConfig != "" {
		cb = append(cb, s)
	}

	b = bastion.New(client, localAppTimeout, cb)
	b.EnableAutoTunnel = autoTunnel
	grpcServer := grpc.NewServer()
	appapi.RegisterLocalAppServer(grpcServer, bastion.NewLocalAppService(b, s))
	allowOrigin := func(origin string) bool {
		// Is the origin a subdomain of the installations hostname?
		return hostRegex.Match([]byte(origin))
	}
	go func() {
		err := http.ListenAndServe("localhost:"+strconv.Itoa(apiPort), grpcweb.WrapServer(grpcServer,
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
		if err != nil {
			logrus.WithError(err).Error("API endpoint failed to start")
			os.Exit(1)
		}
	}()
	defer grpcServer.Stop()
	return b.Run()
}

func connectToServer(loginOpts auth.LoginOpts, reconnectionHandler func(), closeHandler func(error)) (*gitpod.APIoverJSONRPC, error) {
	var client *gitpod.APIoverJSONRPC
	onClose := func(closeErr error) {
		if client != nil {
			closeHandler(closeErr)
		}
	}
	tkn, err := auth.GetToken(loginOpts.GitpodURL)
	if err != nil {
		return nil, err
	}

	if tkn != "" {
		// try to connect with existing token
		client, err = tryConnectToServer(loginOpts.GitpodURL, tkn, reconnectionHandler, onClose)
		if client != nil {
			return client, err
		}
		_, invalid := err.(*auth.ErrInvalidGitpodToken)
		if !invalid {
			return nil, err
		}
		// existing token is invalid, try again
		logrus.WithError(err).WithField("origin", loginOpts.GitpodURL).Error()
	}

	tkn, err = login(loginOpts)
	if err != nil {
		return nil, err
	}
	client, err = tryConnectToServer(loginOpts.GitpodURL, tkn, reconnectionHandler, onClose)
	return client, err
}

func tryConnectToServer(gitpodUrl string, tkn string, reconnectionHandler func(), closeHandler func(error)) (*gitpod.APIoverJSONRPC, error) {
	wshost := gitpodUrl
	wshost = strings.ReplaceAll(wshost, "https://", "wss://")
	wshost = strings.ReplaceAll(wshost, "http://", "ws://")
	wshost += "/api/v1"
	client, err := gitpod.ConnectToServer(wshost, gitpod.ConnectToServerOpts{
		Context:             context.Background(),
		Token:               tkn,
		Log:                 logrus.NewEntry(logrus.StandardLogger()),
		ReconnectionHandler: reconnectionHandler,
		CloseHandler:        closeHandler,
		ExtraHeaders: map[string]string{
			"User-Agent":       "gitpod/local-companion",
			"X-Client-Version": Version,
		},
	})
	if err != nil {
		return nil, err
	}

	err = auth.ValidateToken(client, tkn)
	if err == nil {
		return client, nil
	}

	closeErr := client.Close()
	if closeErr != nil {
		logrus.WithError(closeErr).WithField("origin", gitpodUrl).Warn("failed to close connection to gitpod server")
	}

	deleteErr := auth.DeleteToken(gitpodUrl)
	if deleteErr != nil {
		logrus.WithError(deleteErr).WithField("origin", gitpodUrl).Warn("failed to delete gitpod token")
	}

	return nil, err
}

func login(loginOpts auth.LoginOpts) (string, error) {
	tkn, err := auth.Login(context.Background(), loginOpts)
	if tkn != "" {
		err = auth.SetToken(loginOpts.GitpodURL, tkn)
		if err != nil {
			logrus.WithField("origin", loginOpts.GitpodURL).Warnf("could not write token to keyring: %s", err)
			// Allow to continue
			err = nil
		}
	}
	return tkn, err
}

type logCallbacks struct{}

func (*logCallbacks) InstanceUpdate(w *bastion.Workspace) {
	logrus.WithField("workspace", w).Info("instance update")
}

func printTable(w io.Writer, headers []string, rows [][]string) error {
	writer := tabwriter.NewWriter(w, 0, 4, 1, '\t', tabwriter.AlignRight)

	fmt.Fprintln(writer, strings.Join(headers, "\t"))
	for _, row := range rows {
		fmt.Fprintln(writer, strings.Join(row, "\t"))
	}

	return writer.Flush()
}
