// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package preview

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const harvesterContextName = "harvester"

type Preview struct {
	branch    string
	name      string
	namespace string

	kubeClient *k8s.Config

	logger *logrus.Entry
}

func New(branch string, logger *logrus.Logger) (*Preview, error) {
	if branch == "" {
		out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
		if err != nil {
			logger.WithFields(logrus.Fields{"err": err}).Fatal("Could not retrieve branch name.")
		}
		branch = string(out)
	} else {
		_, err := exec.Command("git", "rev-parse", "--verify", branch).Output()
		if err != nil {
			logger.WithFields(logrus.Fields{"branch": branch, "err": err}).Fatal("Branch does not exist.")
		}
	}

	branch = strings.TrimRight(branch, "\n")
	logEntry := logger.WithFields(logrus.Fields{"branch": branch})

	harvesterConfig, err := k8s.New(logEntry.Logger, harvesterContextName)
	if err != nil {
		return nil, errors.Wrap(err, "couldn't instantiate a k8s config")
	}

	return &Preview{
		branch:     branch,
		namespace:  fmt.Sprintf("preview-%s", GetName(branch)),
		name:       GetName(branch),
		kubeClient: harvesterConfig,
		logger:     logEntry,
	}, nil
}

func (p *Preview) InstallContext(watch bool, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// we use this channel to signal when we've found an event in wait functions, so we know when we're done
	doneCh := make(chan struct{})
	defer close(doneCh)

	// TODO: fix this, as it's a bit ugly
	err := p.kubeClient.GetVMStatus(ctx, p.name, p.namespace)
	if err != nil && !errors.Is(err, k8s.ErrVmNotReady) {
		return err
	} else if errors.Is(err, k8s.ErrVmNotReady) && !watch {
		return err
	} else if errors.Is(err, k8s.ErrVmNotReady) && watch {
		err = p.kubeClient.WaitVMReady(ctx, p.name, p.namespace, doneCh)
		if err != nil {
			return err
		}
	}

	err = p.kubeClient.GetProxyVMServiceStatus(ctx, p.namespace)
	if err != nil && !errors.Is(err, k8s.ErrSvcNotReady) {
		return err
	} else if errors.Is(err, k8s.ErrSvcNotReady) && !watch {
		return err
	} else if errors.Is(err, k8s.ErrSvcNotReady) && watch {
		err = p.kubeClient.WaitProxySvcReady(ctx, p.namespace, doneCh)
		if err != nil {
			return err
		}
	}

	if watch {
		for {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.Tick(5 * time.Second):
				p.logger.Infof("waiting for context install to succeed")
				err = installContext(p.branch)
				if err == nil {
					return nil
				}
			}
		}
	}

	return installContext(p.branch)
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

func GetName(branch string) string {
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

	return sanitizedBranch
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
