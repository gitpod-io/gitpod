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

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
)

var (
	ErrBranchNotExist = errors.New("branch doesn't exist")
)

const harvesterContextName = "harvester"

type Preview struct {
	branch    string
	name      string
	namespace string

	kubeClient *k8s.Config

	logger *logrus.Entry

	vmiCreationTime *metav1.Time
}

func New(branch string, logger *logrus.Logger) (*Preview, error) {
	branch, err := GetName(branch)
	if err != nil {
		return nil, err
	}

	logEntry := logger.WithFields(logrus.Fields{"branch": branch})

	harvesterConfig, err := k8s.NewFromDefaultConfigWithContext(logEntry.Logger, harvesterContextName)
	if err != nil {
		return nil, errors.Wrap(err, "couldn't instantiate a k8s config")
	}

	return &Preview{
		branch:          branch,
		namespace:       fmt.Sprintf("preview-%s", branch),
		name:            branch,
		kubeClient:      harvesterConfig,
		logger:          logEntry,
		vmiCreationTime: nil,
	}, nil
}

func (p *Preview) InstallContext(wait bool, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	p.logger.WithFields(logrus.Fields{"timeout": timeout}).Infof("Installing context")

	// we use this channel to signal when we've found an event in wait functions, so we know when we're done
	doneCh := make(chan struct{})
	defer close(doneCh)

	// TODO: fix this, as it's a bit ugly
	err := p.kubeClient.GetVMStatus(ctx, p.name, p.namespace)
	if err != nil && !errors.Is(err, k8s.ErrVmNotReady) {
		return err
	} else if errors.Is(err, k8s.ErrVmNotReady) && !wait {
		return err
	} else if errors.Is(err, k8s.ErrVmNotReady) && wait {
		err = p.kubeClient.WaitVMReady(ctx, p.name, p.namespace, doneCh)
		if err != nil {
			return err
		}
	}

	err = p.kubeClient.GetProxyVMServiceStatus(ctx, p.namespace)
	if err != nil && !errors.Is(err, k8s.ErrSvcNotReady) {
		return err
	} else if errors.Is(err, k8s.ErrSvcNotReady) && !wait {
		return err
	} else if errors.Is(err, k8s.ErrSvcNotReady) && wait {
		err = p.kubeClient.WaitProxySvcReady(ctx, p.namespace, doneCh)
		if err != nil {
			return err
		}
	}

	if wait {
		for {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.Tick(5 * time.Second):
				p.logger.Infof("waiting for context install to succeed")
				err = installContext(p.branch)
				if err == nil {
					p.logger.Infof("Successfully installed context")
					return nil
				}
			}
		}
	}

	return installContext(p.branch)
}

// Same compares two preview envrionments
//
// Preview environments are considered the same if they are based on the same underlying
// branch and the VM hasn't changed.
func (p *Preview) Same(newPreview *Preview) bool {
	sameBranch := p.branch == newPreview.branch
	if !sameBranch {
		return false
	}

	ensureVMICreationTime(p)
	ensureVMICreationTime(newPreview)

	return p.vmiCreationTime.Equal(newPreview.vmiCreationTime)
}

func ensureVMICreationTime(p *Preview) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if p.vmiCreationTime == nil {
		creationTime, err := p.kubeClient.GetVMICreationTimestamp(ctx, p.name, p.namespace)
		p.vmiCreationTime = creationTime
		if err != nil {
			p.logger.WithFields(logrus.Fields{"err": err}).Infof("Failed to get creation time")
		}
	}
}

func installContext(branch string) error {
	return exec.Command("bash", "/workspace/gitpod/dev/preview/install-k3s-kubeconfig.sh", "-b", branch).Run()
}

func SSHPreview(branch string) error {
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

func (p *Preview) ListAllPreviews() error {
	previews, err := p.kubeClient.GetVMs(context.Background())
	if err != nil {
		return err
	}

	for _, preview := range previews {
		fmt.Printf("%v\n", preview)
	}

	return nil
}
