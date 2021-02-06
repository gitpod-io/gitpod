// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"regexp"
	"strings"
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
		branch := getGitBranch()
		if branch != "" {
			// when debugging branch preview, we need a more realistic version
			res.SourceVersion = fmt.Sprintf("%s.%d", branch, time.Now().Unix())
		} else {
			// keep backward compatibility when running with debug outside of a git tree
			res.SourceVersion = fmt.Sprint(time.Now().Unix())
		}
	}
	return res
}

var branchInvalidCharset = regexp.MustCompile("[^-a-z0-9]")

// getGitBranch attempts to retrieve the current branch @HEAD
// or returns an empty string on error, like when git is not installed
// or no git tree is available
func getGitBranch() string {
	out, err := exec.Command("git", "symbolic-ref", "HEAD").CombinedOutput()
	if err != nil {
		return ""
	}

	branch := strings.TrimSpace(string(out))
	branch = strings.TrimPrefix(branch, "refs/heads/")
	branch = strings.ToLower(branch)
	branch = branchInvalidCharset.ReplaceAllString(branch, "-")

	return branch
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&rootOpts.debug, "debug", false, "enables the debug mode - just useful for development")
	rootCmd.PersistentFlags().StringVar(&rootOpts.destination, "scripts-destination", "", "override the destination field of the layout")
}
