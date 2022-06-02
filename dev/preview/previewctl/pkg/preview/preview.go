// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package preview

import (
	"crypto/sha256"
	"encoding/hex"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

type Preview struct {
	Branch string

	logger *logrus.Entry
}

func New(branch string, logger *logrus.Logger) *Preview {
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

	logEntry := logger.WithFields(logrus.Fields{"branch": branch})

	return &Preview{
		Branch: branch,
		logger: logEntry,
	}
}

func (p *Preview) InstallContext(watch bool) error {
	if watch {
		// The most precise implementation for a watch-loop would be to implement
		// a pub-sub like logic where previewctl would react to changes of a preview IP address.
		// For now just an infinite loop will do!
		installTicker := time.NewTicker(30 * time.Second)

		// nolint:gosimple
		for {
			select {
			case <-installTicker.C:
				err := installContext(p.Branch)
				if err != nil {
					p.logger.WithFields(logrus.Fields{"err": err}).Info("Failed to install context. Trying again in 30 seconds.")
					continue
				}
				p.logger.Info("Context installed.")
				return nil
			}
		}
	}

	return installContext(p.Branch)
}

func installContext(branch string) error {
	return exec.Command("bash", "/workspace/gitpod/dev/preview/install-k3s-kubeconfig.sh", "-b", branch).Run()
}

func (p *Preview) GetPreviewName() string {
	withoutRefsHead := strings.Replace(p.Branch, "/refs/heads/", "", 1)
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
