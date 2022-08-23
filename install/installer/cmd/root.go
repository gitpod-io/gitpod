// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	cryptoRand "crypto/rand"
	"math/rand"
	"os"
	"os/user"
	"path/filepath"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/spf13/cobra"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "gitpod-installer",
	Short: "Installs Gitpod",
}

func Execute() {
	cobra.CheckErr(rootCmd.Execute())
}

var rootOpts struct {
	VersionMF         string
	StrictConfigParse bool
	SeedValue         int64
}

func init() {
	cobra.OnInitialize(setSeed)
	rootCmd.PersistentFlags().StringVar(&rootOpts.VersionMF, "debug-version-file", "", "path to a version manifest - not intended for production use")
	rootCmd.PersistentFlags().Int64Var(&rootOpts.SeedValue, "seed", 0, "specify the seed value for randomization - if 0 it is kept as the default")
	rootCmd.PersistentFlags().BoolVar(&rootOpts.StrictConfigParse, "strict-parse", true, "toggle strict configuration parsing")
}

func setSeed() {
	if rootOpts.SeedValue != 0 {
		rand.Seed(rootOpts.SeedValue)

		// crypto/rand is used by the bcrypt package to generate its random values
		str, err := common.RandomString(64)
		if err != nil {
			panic(err)
		}
		cryptoRand.Reader = strings.NewReader(str)
	}
}

type kubeConfig struct {
	Config string
}

// checkKubeConfig performs validation on the Kubernetes struct and fills in default values if necessary
func checkKubeConfig(kube *kubeConfig) error {
	if kube.Config == "" {
		kube.Config = os.Getenv("KUBECONFIG")
	}
	if kube.Config == "" {
		u, err := user.Current()
		if err != nil {
			return err
		}
		kube.Config = filepath.Join(u.HomeDir, ".kube", "config")
	}

	return nil
}

// getEnvvar gets an envvar and allows a default value
func getEnvvar(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
