// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"k8s.io/client-go/util/homedir"

	kube "github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
)

type installContextCmdOpts struct {
	logger *logrus.Logger

	watch              bool
	timeout            time.Duration
	kubeConfigSavePath string
	sshPrivateKeyPath  string

	getCredentialsOpts *getCredentialsOpts
}

func newInstallContextCmd(logger *logrus.Logger) *cobra.Command {
	ctx := context.Background()

	opts := installContextCmdOpts{
		logger: logger,
		getCredentialsOpts: &getCredentialsOpts{
			logger: logger,
		},
	}

	// Used to ensure that we only install contexts
	var lastSuccessfulPreviewEnvironment *preview.Config = nil

	install := func(timeout time.Duration) error {
		name, err := preview.GetName(branch)
		if err != nil {
			return err
		}

		if hasAccess(ctx, logger, name) {
			opts.logger.Debugf("Access to [%s] already configured and connections can be established", name)
			return nil
		}

		p, err := preview.New(branch, logger)

		if err != nil {
			return err
		}

		if lastSuccessfulPreviewEnvironment != nil && lastSuccessfulPreviewEnvironment.Same(p) {
			logger.Infof("The preview envrionment hasn't changed")
			return nil
		}

		err = p.InstallContext(ctx, preview.InstallCtxOpts{
			Wait:              opts.watch,
			Timeout:           opts.timeout,
			KubeSavePath:      opts.kubeConfigSavePath,
			SSHPrivateKeyPath: opts.sshPrivateKeyPath,
		})

		if err == nil {
			lastSuccessfulPreviewEnvironment = p
		}

		return err
	}

	cmd := &cobra.Command{
		Use:   "install-context",
		Short: "Installs the kubectl context of a preview environment.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			configs, err := opts.getCredentialsOpts.getCredentials(ctx)
			if err != nil {
				return err
			}

			opts.kubeConfigSavePath = getKubeConfigPath()

			err = kube.OutputContext(opts.kubeConfigSavePath, configs)
			if err != nil {
				return err
			}

			if _, err = os.Stat(opts.sshPrivateKeyPath); errors.Is(err, fs.ErrNotExist) {
				return preview.InstallVMSSHKeys()
			}

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if opts.watch {
				for range time.Tick(15 * time.Second) {
					// We're using a short timeout here to handle the scenario where someone switches
					// to a branch that doens't have a preview envrionment. In that case the default
					// timeout would mean that we would block for 10 minutes, potentially missing
					// if the user changes to a new branch that does that a preview.
					err := install(30 * time.Second)
					if err != nil {
						logger.WithFields(logrus.Fields{"err": err}).Info("Failed to install context. Trying again soon.")
					}
				}
			} else {
				return install(opts.timeout)
			}

			return nil
		},
	}

	cmd.Flags().BoolVar(&opts.watch, "watch", false, "If watch is enabled, previewctl will keep trying to install the kube-context every 15 seconds.")
	cmd.Flags().DurationVarP(&opts.timeout, "timeout", "t", 10*time.Minute, "Timeout before considering the installation failed")
	cmd.PersistentFlags().StringVar(&opts.sshPrivateKeyPath, "private-key-path", fmt.Sprintf("%s/.ssh/vm_id_rsa", homedir.HomeDir()), "path to the private key used to authenticate with the VM")
	cmd.PersistentFlags().StringVar(&opts.getCredentialsOpts.serviceAccountPath, "gcp-service-account", "", "path to the GCP service account to use")

	return cmd
}
