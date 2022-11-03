// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package preview

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context/k3s"
)

var (
	ErrBranchNotExist = errors.New("branch doesn't exist")
)

const harvesterContextName = "harvester"

type Config struct {
	branch    string
	name      string
	namespace string

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
		branch:          branch,
		namespace:       fmt.Sprintf("preview-%s", branch),
		name:            branch,
		harvesterClient: harvesterConfig,
		logger:          logEntry,
		vmiCreationTime: nil,
	}, nil
}

type InstallCtxOpts struct {
	Wait              bool
	Timeout           time.Duration
	KubeSavePath      string
	SSHPrivateKeyPath string
}

func (c *Config) InstallContext(ctx context.Context, opts InstallCtxOpts) error {
	// TODO: https://github.com/gitpod-io/ops/issues/6524
	if c.configLoader == nil {
		configLoader, err := k3s.New(ctx, k3s.ConfigLoaderOpts{
			Logger:            c.logger.Logger,
			PreviewName:       c.name,
			PreviewNamespace:  c.namespace,
			SSHPrivateKeyPath: opts.SSHPrivateKeyPath,
			SSHUser:           "ubuntu",
		})

		if err != nil {
			return err
		}

		c.configLoader = configLoader
	}

	ctx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	c.logger.WithFields(logrus.Fields{"timeout": opts.Timeout}).Debug("Installing context")

	// we use this channel to signal when we've found an event in wait functions, so we know when we're done
	doneCh := make(chan struct{})
	defer close(doneCh)

	err := c.harvesterClient.GetVMStatus(ctx, c.name, c.namespace)
	if err != nil && !errors.Is(err, k8s.ErrVmNotReady) {
		return err
	} else if errors.Is(err, k8s.ErrVmNotReady) && !opts.Wait {
		return err
	} else if errors.Is(err, k8s.ErrVmNotReady) && opts.Wait {
		err = c.harvesterClient.WaitVMReady(ctx, c.name, c.namespace, doneCh)
		if err != nil {
			return err
		}
	}

	err = c.harvesterClient.GetProxyVMServiceStatus(ctx, c.namespace)
	if err != nil && !errors.Is(err, k8s.ErrSvcNotReady) {
		return err
	} else if errors.Is(err, k8s.ErrSvcNotReady) && !opts.Wait {
		return err
	} else if errors.Is(err, k8s.ErrSvcNotReady) && opts.Wait {
		err = c.harvesterClient.WaitProxySvcReady(ctx, c.namespace, doneCh)
		if err != nil {
			return err
		}
	}

	if opts.Wait {
		for {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.Tick(5 * time.Second):
				c.logger.Infof("waiting for context install to succeed")
				err = c.Install(ctx, opts)
				if err == nil {
					c.logger.Infof("Successfully installed context")
					return nil
				}
			}
		}
	}

	return c.Install(ctx, opts)
}

// Same compares two preview envrionments
//
// Config environments are considered the same if they are based on the same underlying
// branch and the VM hasn't changed.
func (c *Config) Same(newPreview *Config) bool {
	sameBranch := c.branch == newPreview.branch
	if !sameBranch {
		return false
	}

	ensureVMICreationTime(c)
	ensureVMICreationTime(newPreview)

	return c.vmiCreationTime.Equal(newPreview.vmiCreationTime)
}

func ensureVMICreationTime(c *Config) {
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

func (c *Config) Install(ctx context.Context, opts InstallCtxOpts) error {
	cfg, err := c.GetPreviewContext(ctx)
	if err != nil {
		return err
	}

	merged, err := k8s.MergeContextsWithDefault(cfg)
	if err != nil {
		return err
	}

	return k8s.OutputContext(opts.KubeSavePath, merged)
}

func (c *Config) GetPreviewContext(ctx context.Context) (*api.Config, error) {
	return c.configLoader.Load(ctx)
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

func branchFromGit(branch string) (string, error) {
	if branch == "" {
		out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
		if err != nil {
			return "", errors.Wrap(err, "Could not retrieve branch name.")
		}

		branch = string(out)
	} else {
		_, err := exec.Command("git", "rev-parse", "--verify", branch).Output()
		if err != nil {
			return "", errors.CombineErrors(err, ErrBranchNotExist)
		}
	}

	return branch, nil
}

func GetName(branch string) (string, error) {
	var err error
	if branch == "" {
		branch, err = branchFromGit(branch)
		if err != nil {
			return "", err
		}
	}

	branch = strings.TrimSpace(branch)
	withoutRefsHead := strings.Replace(branch, "/refs/heads/", "", 1)
	lowerCased := strings.ToLower(withoutRefsHead)

	var re = regexp.MustCompile(`[^-a-z0-9]`)
	sanitizedBranch := re.ReplaceAllString(lowerCased, `$1-$2`)

	if len(sanitizedBranch) > 20 {
		h := sha256.New()
		h.Write([]byte(sanitizedBranch))
		hashedBranch := hex.EncodeToString(h.Sum(nil))

		sanitizedBranch = sanitizedBranch[0:10] + hashedBranch[0:10]
	}

	return sanitizedBranch, nil
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
