/*
Copyright © 2023 NAME HERE <EMAIL ADDRESS>
*/
package cmd

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	appapi "github.com/gitpod-io/gitpod/local-app/api"

	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/bastion"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/zalando/go-keyring"
	"google.golang.org/grpc"
)

var (
	gitpodHost        string
	mockKeyring       bool
	allowCORSFromPort bool
	apiPort           int
	autoTunnel        bool
	authRedirectURL   string
	verbose           bool
	authTimeout       time.Duration
	localAppTimeout   time.Duration
	sshConfigPath     string
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Runs port-forwarding",
	RunE: func(cmd *cobra.Command, args []string) error {
		if mockKeyring {
			keyring.MockInit()
		}
		return run(runOptions{
			origin:            gitpodHost,
			sshConfigPath:     sshConfigPath,
			apiPort:           apiPort,
			allowCORSFromPort: allowCORSFromPort,
			autoTunnel:        autoTunnel,
			authRedirectURL:   authRedirectURL,
			verbose:           verbose,
			authTimeout:       authTimeout,
			localAppTimeout:   localAppTimeout,
		})
	},
}

func init() {
	rootCmd.AddCommand(runCmd)

	sshConfig := os.Getenv("GITPOD_LCA_SSH_CONFIG")
	if sshConfig == "" {
		sshConfig = filepath.Join(os.TempDir(), "gitpod_ssh_config")
	}

	runCmd.Flags().StringP("gitpod-host", "g", "https://gitpod.io", "URL of the Gitpod installation to connect to")
	runCmd.Flags().BoolVarP(&mockKeyring, "mock-keyring", "m", false, "Don't use system native keyring, but store Gitpod token in memory")
	runCmd.Flags().BoolVarP(&allowCORSFromPort, "allow-cors-from-port", "c", false, "Allow CORS requests from workspace port location")
	runCmd.Flags().IntVarP(&apiPort, "api-port", "a", 63100, "Local App API endpoint's port")
	runCmd.Flags().BoolVarP(&autoTunnel, "auto-tunnel", "t", true, "Enable auto tunneling")
	runCmd.Flags().StringVarP(&authRedirectURL, "auth-redirect-url", "r", "", "Auth redirect URL")
	runCmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose logging")
	runCmd.Flags().DurationVarP(&authTimeout, "auth-timeout", "u", 30, "Auth timeout in seconds")
	runCmd.Flags().DurationVarP(&localAppTimeout, "timeout", "o", 0, "How long the local app can run if last workspace was stopped")
	runCmd.Flags().StringVarP(&sshConfigPath, "ssh_config", "s", sshConfig, "produce and update an OpenSSH compatible ssh_config file (defaults to $GITPOD_LCA_SSH_CONFIG)")
}

type runOptions struct {
	origin            string
	sshConfigPath     string
	apiPort           int
	allowCORSFromPort bool
	autoTunnel        bool
	authRedirectURL   string
	verbose           bool
	authTimeout       time.Duration
	localAppTimeout   time.Duration
}

func run(opts runOptions) error {
	if opts.verbose {
		logrus.SetLevel(logrus.DebugLevel)
	}
	logrus.WithField("ssh_config", opts.sshConfigPath).Info("writing workspace ssh_config file")

	// Trailing slash(es) result in connection issues, so remove them preemptively
	origin := strings.TrimRight(opts.origin, "/")
	originURL, err := url.Parse(origin)
	if err != nil {
		return err
	}
	wsHostRegex := "(\\.[^.]+)\\." + strings.ReplaceAll(originURL.Host, ".", "\\.")
	wsHostRegex = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8,11})" + wsHostRegex
	if opts.allowCORSFromPort {
		wsHostRegex = "([0-9]+)-" + wsHostRegex
	}
	hostRegex, err := regexp.Compile("^" + wsHostRegex)
	if err != nil {
		return err
	}

	var b *bastion.Bastion

	client, err := connectToServer(auth.LoginOpts{GitpodURL: origin, RedirectURL: opts.authRedirectURL, AuthTimeout: opts.authTimeout}, func() {
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

	s := &bastion.SSHConfigWritingCallback{Path: opts.sshConfigPath}
	if opts.sshConfigPath != "" {
		cb = append(cb, s)
	}

	b = bastion.New(client, opts.localAppTimeout, cb)
	b.EnableAutoTunnel = opts.autoTunnel
	grpcServer := grpc.NewServer()
	appapi.RegisterLocalAppServer(grpcServer, bastion.NewLocalAppService(b, s))
	allowOrigin := func(origin string) bool {
		// Is the origin a subdomain of the installations hostname?
		return hostRegex.Match([]byte(origin))
	}
	go func() {
		err := http.ListenAndServe("localhost:"+strconv.Itoa(opts.apiPort), grpcweb.WrapServer(grpcServer,
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

	tkn, err = Login(loginOpts)
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
			"User-Agent": "gitpod/local-companion",
			//todo: import from main somehow
			"X-Client-Version": "DEV",
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

type logCallbacks struct{}

func (*logCallbacks) InstanceUpdate(w *bastion.Workspace) {
	logrus.WithField("workspace", w).Info("Instance update")
}
