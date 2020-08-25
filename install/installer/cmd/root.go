// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"io/ioutil"
	"os"
	"time"

	"github.com/gitpod-io/installer/pkg/sources"
	"github.com/gitpod-io/installer/pkg/ui"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var rootOpts struct {
	debug       bool
	destination string
}

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "installer",
	Short: "Simple CLI to aid installing Gitpod",
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func getLayout() sources.Layout {
	fn := os.Getenv("INSTALLER_LAYOUT_FILE")
	if fn == "" {
		if rootOpts.debug {
			fn = "dev-layout.yaml"
		} else {
			fn = "layout.yaml"
		}
	}

	f, err := os.Open(fn)
	if err != nil {
		ui.Fatalf("cannot load installer layout:\n\t%q", err)
	}
	defer f.Close()

	var l sources.Layout
	err = yaml.NewDecoder(f).Decode(&l)
	if err != nil {
		ui.Fatalf("cannot load installer layout:\n\t%q", err)
	}

	if l.Destination == "" {
		l.Destination = rootOpts.destination
	}
	if rootOpts.debug && l.Destination == "" {
		loc, err := ioutil.TempDir("", "gitpod-installer-*")
		if err != nil {
			ui.Fatalf("cannot create tempdir:\n\t%q", err)
		}
		ui.Infof("created temp destination directory: %s", loc)
		l.Destination = loc
	}

	return l
}

func getCloneAndOwnOpts() sources.CloneAndOwnOpts {
	var res sources.CloneAndOwnOpts
	if rootOpts.debug {
		res.SourceVersion = fmt.Sprint(time.Now().Unix())
	}
	return res
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&rootOpts.debug, "debug", false, "enables the debug mode - just useful for development")
	rootCmd.PersistentFlags().StringVar(&rootOpts.destination, "scripts-destination", "", "override the destination field of the layout")
}
