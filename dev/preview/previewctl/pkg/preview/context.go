// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package preview

import (
	"context"
	"sync"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context/k3s"
)

type InstallCtxOpts struct {
	Retry        bool
	RetryTimeout time.Duration

	KubeSavePath      string
	SSHPrivateKeyPath string

	KubeconfigWriteMutex *sync.Mutex
}

func (c *Config) InstallContext(ctx context.Context, opts *InstallCtxOpts) error {
	if previewCfg, err := k8s.NewFromDefaultConfigWithContext(c.logger.Logger, c.name); err == nil {
		c.logger.WithFields(logrus.Fields{"preview": c.name}).Info("Context already exists")
		if previewCfg.HasAccess(ctx) {
			c.previewClient = previewCfg
			return nil
		}

		c.logger.WithFields(logrus.Fields{"preview": c.name}).Info("Context already exists, but has no access. Retrying install")
		k8s.DeleteContext(previewCfg.ClientConfig(), c.name)
	}

	// TODO: https://github.com/gitpod-io/ops/issues/6524
	if c.configLoader == nil {
		configLoader, err := k3s.New(ctx, k3s.ConfigLoaderOpts{
			Logger:            c.logger.Logger,
			PreviewName:       c.name,
			SSHPrivateKeyPath: opts.SSHPrivateKeyPath,
			SSHUser:           "ubuntu",
		})

		if err != nil {
			return err
		}

		c.configLoader = configLoader
	}

	ctx, cancel := context.WithTimeout(ctx, opts.RetryTimeout)
	defer cancel()

	c.logger.WithFields(logrus.Fields{"timeout": opts.RetryTimeout}).Debug("Installing context")

	if opts.Retry {
		for {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.Tick(10 * time.Second):
				c.logger.Infof("waiting for context install to succeed")
				err := c.install(ctx, opts)
				if err == nil {
					c.logger.Infof("Successfully installed context")
					return nil
				}

				c.logger.Errorf("error installing context: [%v]", err)
			}
		}
	}

	return c.install(ctx, opts)
}

func (c *Config) install(ctx context.Context, opts *InstallCtxOpts) error {
	cfg, err := c.GetPreviewContext(ctx)
	if err != nil {
		return err
	}

	merged, err := k8s.MergeContextsWithDefault(cfg)
	if err != nil {
		return err
	}

	if opts.KubeconfigWriteMutex != nil {
		opts.KubeconfigWriteMutex.Lock()
	}

	err = k8s.OutputContext(opts.KubeSavePath, merged)
	if err != nil {
		return err
	}

	previewCfg, err := k8s.NewFromDefaultConfigWithContext(c.logger.Logger, c.name)
	if err != nil {
		return errors.Wrap(err, "couldn't instantiate a k8s config")
	}

	if opts.KubeconfigWriteMutex != nil {
		opts.KubeconfigWriteMutex.Unlock()
	}

	c.previewClient = previewCfg

	return nil
}

func (c *Config) GetPreviewContext(ctx context.Context) (*api.Config, error) {
	return c.configLoader.Load(ctx)
}
