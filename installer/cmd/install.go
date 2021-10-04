// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/spf13/cobra"
	"os"
	"time"
)

var installConfig struct {
	certManager bool
	configFile  string
	jaeger      bool
	timeout     time.Duration
}

// installCmd represents the install command
var installCmd = &cobra.Command{
	Use:   "install",
	Short: "Install Gitpod to the desired cluster",
	RunE: func(cmd *cobra.Command, args []string) error {
		debug, err := cmd.Root().PersistentFlags().GetBool("debug")
		if err != nil {
			return err
		}

		dryRun, err := cmd.Root().PersistentFlags().GetBool("dry-run")
		if err != nil {
			return err
		}

		kubeconfig, err := cmd.Root().PersistentFlags().GetString("kubeconfig")
		if err != nil {
			return err
		}

		kubecontext, err := cmd.Root().PersistentFlags().GetString("kube-context")
		if err != nil {
			return err
		}

		name, err := cmd.Root().PersistentFlags().GetString("name")
		if err != nil {
			return err
		}

		namespace, err := cmd.Root().PersistentFlags().GetString("namespace")
		if err != nil {
			return err
		}

		cfg, err := config.Load(installConfig.configFile)
		if err != nil {
			return fmt.Errorf("error loading config: %w", err)
		}

		versionManifest, err := versions.GetManifest()
		if err != nil {
			return err
		}

		ctx := &common.RenderContext{
			Config:          *cfg,
			VersionManifest: *versionManifest,
			Namespace:       namespace,
		}

		var renderable common.RenderFunc
		switch ctx.Config.Kind {
		case config.InstallationFull:
			renderable = components.FullObjects
		case config.InstallationMeta:
			renderable = components.MetaObjects
		case config.InstallationWorkspace:
			renderable = components.WorkspaceObjects
		default:
			return fmt.Errorf("unsupported installation kind: %s", ctx.Config.Kind)
		}

		rendered, err := common.RenderToYaml(ctx, renderable)
		if err != nil {
			return err
		}

		settings, err := helm.Install(&helm.Config{
			CertManager: installConfig.certManager,
			ConfigFile:  installConfig.configFile,
			Debug:       debug,
			DryRun:      dryRun,
			Jaeger:      installConfig.jaeger,
			KubeConfig:  kubeconfig,
			KubeContext: kubecontext,
			Name:        name,
			Namespace:   namespace,
			Timeout:     installConfig.timeout,
		}, rendered)
		if err != nil {
			return err
		}

		// Always print final line
		if dryRun {
			fmt.Println(fmt.Sprintf("Installation files written to %s", settings.Chart))
		} else {
			fmt.Println("Successfully installed Gitpod to your cluster")
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(installCmd)

	installCmd.Flags().StringVarP(&installConfig.configFile, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "Path to the config file")
	installCmd.Flags().BoolVar(&installConfig.certManager, "cert-manager", true, "Install cert-manager")
	installCmd.Flags().BoolVar(&installConfig.jaeger, "jaeger", true, "Install Jaeger")
	installCmd.Flags().DurationVar(&installConfig.timeout, "timeout", time.Minute*5, "Time to wait for job to complete")
}
