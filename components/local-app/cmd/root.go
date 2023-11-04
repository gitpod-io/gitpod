// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/components/public-api/go/client"
	"github.com/gitpod-io/local-app/pkg/auth"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/gookit/color"
	"github.com/lmittmann/tint"
	"github.com/mattn/go-isatty"
	"github.com/spf13/cobra"
)

var rootOpts struct {
	ConfigLocation string
	Verbose        bool
}

var rootCmd = &cobra.Command{
	Use:   "gitpod",
	Short: "Gitpod: Always ready to code.",
	Long: color.Sprint(`
<fg=ff971d>      .-+*#+           </>      <b>Gitpod: Always ready to code.</>
<fg=ff971d>   :=*#####*.          </>      Try the following commands to get started:
<fg=ff971d>  .=*####*+-.    .--:  </>
<fg=ff971d>  +****=:     :=*####+ </>      gitpod login              <lightgray>Login to Gitpod</>
<fg=ff971d>  ****:   .-+*########.</>      gitpod whoami             <lightgray>Show information about the currently logged in user</>
<fg=ff971d>  +***:   *****+--####.</>
<fg=ff971d>  +***:   .-=:.  .#*##.</>      gitpod workspace list     <lightgray>List your workspaces</>
<fg=ff971d>  +***+-.      .-+**** </>      gitpod workspace create   <lightgray>Create a new workspace</>
<fg=ff971d>  .=*****+=::-+*****+: </>      gitpod workspace open     <lightgray>Open a running workspace</>
<fg=ff971d>  .:=+*********=-.     </>      gitpod workspace stop     <lightgray>Stop a running workspace</>
<fg=ff971d>      .-++++=:         </>

	`),
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
		prettyprint.PrintError(os.Stderr, os.Args[0], err)

		os.Exit(1)
	}
}

func init() {
	if !isatty.IsTerminal(os.Stdout.Fd()) || !isatty.IsTerminal(os.Stderr.Fd()) {
		color.Disable()
	}

	configLocation := config.DEFAULT_LOCATION
	if fn := os.Getenv("GITPOD_CONFIG"); fn != "" {
		configLocation = fn
	}
	rootCmd.PersistentFlags().StringVar(&rootOpts.ConfigLocation, "config", configLocation, "Location of the configuration file")
	rootCmd.PersistentFlags().BoolVarP(&rootOpts.Verbose, "verbose", "v", false, "Display verbose output for more detailed logging")
}

var rootTestingOpts struct {
	Client    *client.Gitpod
	WriterOut io.Writer
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

	if gpctx.Host.String() == "https://testing" && rootTestingOpts.Client != nil {
		return rootTestingOpts.Client, nil
	}

	var apiHost = *gpctx.Host.URL
	apiHost.Host = "api." + apiHost.Host
	slog.Debug("establishing connection to Gitpod", "host", apiHost.String())
	res, err := client.New(
		client.WithCredentials(token),
		client.WithURL(apiHost.String()),
		client.WithHTTPClient(&http.Client{
			Transport: &auth.AuthenticatedTransport{Token: token, T: http.DefaultTransport},
		}),
	)
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
	var out io.Writer = os.Stdout
	if rootTestingOpts.WriterOut != nil {
		out = rootTestingOpts.WriterOut
	}
	return &prettyprint.Writer{
		Field:      opts.Field,
		LongFormat: longFormat,
		Out:        out,
	}
}

func addFormatFlags(cmd *cobra.Command, opts *formatOpts) {
	cmd.Flags().StringVarP(&opts.Field, "field", "f", "", "Only print the specified field")
}
