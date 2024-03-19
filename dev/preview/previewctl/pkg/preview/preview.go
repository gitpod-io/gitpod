// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package preview

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"cloud.google.com/go/storage"
	"github.com/sirupsen/logrus"
	"google.golang.org/api/option"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context/k3s"
)

const TFStateBucket = "3f4745df-preview-tf-state"

type Config struct {
	branch string
	name   string

	status Status

	previewClient *k8s.Config
	storageClient *storage.Client
	configLoader  *k3s.ConfigLoader

	logger *logrus.Entry

	creationTime *time.Time
}

type Option func(opts *Config)

func WithServiceAccountPath(serviceAccountPath string) Option {
	return func(config *Config) {
		if serviceAccountPath == "" {
			return
		}
		storageClient, err := storage.NewClient(context.Background(), option.WithCredentialsFile(serviceAccountPath))
		if err != nil {
			return
		}
		config.storageClient = storageClient
	}
}

func New(branch string, logger *logrus.Logger, opts ...Option) (*Config, error) {
	branch, err := GetName(branch)
	if err != nil {
		return nil, err
	}

	logEntry := logger.WithFields(logrus.Fields{"branch": branch})

	config := &Config{
		branch: branch,
		name:   branch,
		status: Status{
			Name: branch,
		},
		logger:       logEntry,
		creationTime: nil,
	}
	for _, o := range opts {
		o(config)
	}
	if config.storageClient == nil {
		config.storageClient, err = storage.NewClient(context.Background())
		if err != nil {
			return nil, err
		}
	}

	return config, nil

}

// Same compares two preview environments
//
// Config environments are considered the same if they are based on the same underlying
// branch and the VM hasn't changed.
func (c *Config) Same(newPreview *Config) bool {
	sameBranch := c.branch == newPreview.branch
	if !sameBranch {
		return false
	}

	c.ensureCreationTime()
	newPreview.ensureCreationTime()

	if c.creationTime == nil {
		return false
	}

	return c.creationTime.Equal(*newPreview.creationTime)
}

// ensureCreationTime best-effort guess on when the preview got created, based on the creation timestamp of the service
func (c *Config) ensureCreationTime() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if c.creationTime == nil {
		attr, err := c.storageClient.Bucket(TFStateBucket).Object("preview/" + c.name + ".tfstate").Attrs(ctx)
		if err != nil {
			c.logger.WithFields(logrus.Fields{"err": err}).Infof("Failed to get creation time")
			return
		}
		c.creationTime = &attr.Created
	}
}

func (c *Config) GetName() string {
	return c.name
}

func InstallVMSSHKeys() error {
	// TODO: https://github.com/gitpod-io/ops/issues/6524
	path := filepath.Join(os.Getenv("LEEWAY_WORKSPACE_ROOT"), "dev/preview/util/install-vm-ssh-keys.sh")
	return exec.Command("bash", path).Run()
}

func SSHPreview(branch string) error {
	branch, err := GetName(branch)
	if err != nil {
		return err
	}

	path := filepath.Join(os.Getenv("LEEWAY_WORKSPACE_ROOT"), "dev/preview/ssh-vm.sh")
	sshCommand := exec.Command("bash", path, "-b", branch)

	// We need to bind standard output files to the command
	// otherwise 'previewctl' will exit as soon as the script is run.
	sshCommand.Stderr = os.Stderr
	sshCommand.Stdin = os.Stdin
	sshCommand.Stdout = os.Stdout

	return sshCommand.Run()
}
