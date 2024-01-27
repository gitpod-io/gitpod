// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"k8s.io/client-go/util/homedir"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
)

func newGetCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "get",
		Short: "",
		RunE: func(cmd *cobra.Command, args []string) error {
			return nil
		},
	}

	cmd.AddCommand(
		newGetNameSubCmd(),
		newGetActiveCmd(logger),
		newGetUrlSubCmd(),
	)

	return cmd
}

func newGetNameSubCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "name",
		Short: "",
		RunE: func(cmd *cobra.Command, args []string) error {
			previewName, err := preview.GetName(branch)
			if err != nil {
				return err
			}

			fmt.Println(previewName)

			return nil
		},
	}

	return cmd
}

func newGetUrlSubCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "url",
		Short: "",
		RunE: func(cmd *cobra.Command, args []string) error {
			previewName, err := preview.GetName(branch)
			if err != nil {
				return err
			}

			previewUrl := fmt.Sprintf("https://%s.preview.gitpod-dev.com", previewName)
			fmt.Println(previewUrl)

			return nil
		},
	}

	return cmd
}

func newGetActiveCmd(logger *logrus.Logger) *cobra.Command {
	ctx := context.Background()

	cmd := &cobra.Command{
		Use:   "active",
		Short: "Checks if the preview environment is active",
		RunE: func(cmd *cobra.Command, args []string) error {
			p, err := preview.New(branch, logger)
			if err != nil {
				return err
			}

			logger.WithFields(logrus.Fields{
				"preview": p.GetName(),
			}).Info("Installing context")

			err = p.InstallContext(ctx, &preview.InstallCtxOpts{
				Retry:             true,
				RetryTimeout:      1 * time.Minute,
				KubeSavePath:      getKubeConfigPath(),
				SSHPrivateKeyPath: fmt.Sprintf("%s/.ssh/vm_id_rsa", homedir.HomeDir()),
			})

			if err != nil {
				return err
			}

			status, err := p.GetStatus(ctx)
			if err != nil {
				return err
			}

			fmt.Printf("Preview [%s] is [%t]. Reason: [%s]", p.GetName(), status.Active, status.Reason)

			return nil
		},
	}

	return cmd
}
