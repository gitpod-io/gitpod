// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/components/public-api/go/client"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/lmittmann/tint"
	"github.com/mattn/go-isatty"
	"github.com/spf13/cobra"
)

var rootOpts struct {
	ConfigLocation string
	Verbose        bool
}

var rootCmd = &cobra.Command{
	Use:           "gitpod",
	Short:         "A CLI for interacting with Gitpod",
	SilenceErrors: true,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		level := slog.LevelInfo
		if rootOpts.Verbose {
			level = slog.LevelDebug
		}
		var noColor bool
		if !isatty.IsTerminal(os.Stdout.Fd()) {
			noColor = true
		}
		slog.SetDefault(slog.New(tint.NewHandler(os.Stdout, &tint.Options{
			Level:      level,
			NoColor:    noColor,
			TimeFormat: time.StampMilli,
		})))

		cfg, err := config.LoadConfig(rootOpts.ConfigLocation)
		if errors.Is(err, os.ErrNotExist) {
			err = nil
		}
		if err != nil {
			return err
		}
		cmd.SetContext(config.ToContext(context.Background(), cfg))
		return nil
	},
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		nocolor := !isatty.IsTerminal(os.Stderr.Fd())
		prettyprint.PrintError(os.Stderr, err, nocolor)
		prettyprint.PrintResolutions(os.Stderr, os.Args[0], err, nocolor)

		os.Exit(1)
	}
}

func init() {
	slog.Debug("Configured configuration and environment variables")

	rootCmd.PersistentFlags().BoolVarP(&rootOpts.Verbose, "verbose", "v", false, "Display verbose output for more detailed logging")

	configLocation := config.DEFAULT_LOCATION
	if fn := os.Getenv("GITPOD_CONFIG"); fn != "" {
		configLocation = fn
	}
	rootCmd.PersistentFlags().StringVar(&rootOpts.ConfigLocation, "config", configLocation, "Location of the configuration file")
}

func getGitpodClient(ctx context.Context) (*client.Gitpod, error) {
	cfg := config.FromContext(ctx)
	gpctx, err := cfg.GetActiveContext()
	if err != nil {
		return nil, err
	}

	token := gpctx.Token
	if token == "" {
		token = os.Getenv("GITPOD_TOKEN")
	}
	if token == "" {
		var err error
		token, err = auth.GetToken(gpctx.Host.String())
		if err != nil {
			return nil, err
		}
	}
	if token == "" {
		return nil, fmt.Errorf("no token found for host %s: neither the active context, nor keychain, nor GITPOD_TOKEN environment variable provide one. Please run `gitpod login` to login", gpctx.Host.String())
	}

	var apiHost = *gpctx.Host.URL
	apiHost.Host = "api." + apiHost.Host
	slog.Debug("establishing connection to Gitpod", "host", apiHost.String())
	res, err := client.New(client.WithCredentials(token), client.WithURL(apiHost.String()))
	if err != nil {
		return nil, err
	}

	return res, nil
}

type formatOpts struct {
	Field string
}

// Writer returns a prettyprint.Writer that can be used to print the output of a command
func (opts *formatOpts) Writer(longFormat bool) *prettyprint.Writer {
	return &prettyprint.Writer{
		Field:      opts.Field,
		LongFormat: longFormat,
		Out:        os.Stdout,
	}
}

func addFormatFlags(cmd *cobra.Command, opts *formatOpts) {
	cmd.Flags().StringVarP(&opts.Field, "field", "f", "", "Only print the specified field")
}
