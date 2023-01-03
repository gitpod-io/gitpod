// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package preview

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context/k3s"
)

type Config struct {
	branch    string
	name      string
	namespace string

	status Status

	previewClient   *k8s.Config
	harvesterClient *k8s.Config
	configLoader    *k3s.ConfigLoader

	logger *logrus.Entry

	vmiCreationTime *metav1.Time
}

func New(branch string, logger *logrus.Logger) (*Config, error) {
	branch, err := GetName(branch)
	if err != nil {
		return nil, err
	}

	logEntry := logger.WithFields(logrus.Fields{"branch": branch})

	harvesterConfig, err := k8s.NewFromDefaultConfigWithContext(logEntry.Logger, harvesterContextName)
	if err != nil {
		return nil, errors.Wrap(err, "couldn't instantiate a k8s config")
	}

	return &Config{
		branch:    branch,
		namespace: fmt.Sprintf("preview-%s", branch),
		name:      branch,
		status: Status{
			Name: branch,
		},
		harvesterClient: harvesterConfig,
		logger:          logEntry,
		vmiCreationTime: nil,
	}, nil
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

	c.ensureVMICreationTime()
	newPreview.ensureVMICreationTime()

	return c.vmiCreationTime.Equal(newPreview.vmiCreationTime)
}

func (c *Config) ensureVMICreationTime() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if c.vmiCreationTime == nil {
		creationTime, err := c.harvesterClient.GetVMICreationTimestamp(ctx, c.name, c.namespace)
		c.vmiCreationTime = creationTime
		if err != nil {
			c.logger.WithFields(logrus.Fields{"err": err}).Infof("Failed to get creation time")
		}
	}
}

func (c *Config) ListAllPreviews(ctx context.Context) error {
	previews, err := c.harvesterClient.GetVMs(ctx)
	if err != nil {
		return err
	}

	for _, preview := range previews {
		fmt.Printf("%v\n", preview)
	}

	return nil
}

func (c *Config) GetPreviewEnvironments(ctx context.Context) ([]string, error) {
	return c.harvesterClient.GetVMs(ctx)
}

func (c *Config) GetName() string {
	return c.name
}

func InstallVMSSHKeys() error {
	// TODO: https://github.com/gitpod-io/ops/issues/6524
	return exec.Command("bash", "/workspace/gitpod/dev/preview/util/install-vm-ssh-keys.sh").Run()
}

func SSHPreview(branch string) error {
	branch, err := GetName(branch)
	if err != nil {
		return err
	}
	sshCommand := exec.Command("bash", "/workspace/gitpod/dev/preview/ssh-vm.sh", "-b", branch)

	// We need to bind standard output files to the command
	// otherwise 'previewctl' will exit as soon as the script is run.
	sshCommand.Stderr = os.Stderr
	sshCommand.Stdin = os.Stdin
	sshCommand.Stdout = os.Stdout

	return sshCommand.Run()
}
