// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"strconv"
	"syscall"

	"github.com/opencontainers/runtime-spec/specs-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

const DaemonArgs = "DOCKERD_ARGS"
const DEFAULT_RETRY = 3

var (
	defaultOOMScoreAdj = 1000
)

func main() {
	log := logrus.New()
	log.SetLevel(logrus.DebugLevel)

	var err error
	runcPath, err := exec.LookPath("runc")
	if err != nil {
		log.WithError(err).Fatal("runc not found")
	}

	var useFacade bool
	for _, arg := range os.Args {
		if arg == "create" {
			useFacade = true
			break
		}
	}

	if useFacade {
		err = createAndRunc(runcPath, log)
	} else {
		err = syscall.Exec(runcPath, os.Args, os.Environ())
	}
	if err != nil {
		log.WithError(err).Fatal("failed")
	}
}

func createAndRunc(runcPath string, log *logrus.Logger) error {
	fc, err := os.ReadFile("config.json")
	if err != nil {
		return xerrors.Errorf("cannot read config.json: %w", err)
	}

	var cfg specs.Spec
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return xerrors.Errorf("cannot decode config.json: %w", err)
	}

	cfg.Process.OOMScoreAdj = &defaultOOMScoreAdj
	delete(cfg.Linux.Sysctl, "net.ipv4.ip_unprivileged_port_start")
	// TODO(toru): Drop the `kernel.domainame`` setting as it currently fails in the rootless container.
	// - https://github.com/opencontainers/runc/issues/2091
	// - https://github.com/opencontainers/runtime-spec/issues/592
	// Perhaps using OCI hooks can solve this problem, but it's a bit tricky and hard.
	if _, ok := cfg.Linux.Sysctl["kernel.domainname"]; ok {
		log.Warnln("Since the rootless container cannot use domainname yet, we ignored it.")
		delete(cfg.Linux.Sysctl, "kernel.domainname")
	}
	cfg.Process.Capabilities.Ambient = append(cfg.Process.Capabilities.Ambient, "CAP_NET_BIND_SERVICE")
	cfg.Process.Capabilities.Bounding = append(cfg.Process.Capabilities.Bounding, "CAP_NET_BIND_SERVICE")
	cfg.Process.Capabilities.Effective = append(cfg.Process.Capabilities.Effective, "CAP_NET_BIND_SERVICE")
	cfg.Process.Capabilities.Inheritable = append(cfg.Process.Capabilities.Inheritable, "CAP_NET_BIND_SERVICE")
	cfg.Process.Capabilities.Permitted = append(cfg.Process.Capabilities.Permitted, "CAP_NET_BIND_SERVICE")

	fc, err = json.Marshal(cfg)
	if err != nil {
		return xerrors.Errorf("cannot encode config.json: %w", err)
	}
	for _, fn := range []string{"config.json", "/tmp/debug.json"} {
		err = os.WriteFile(fn, fc, 0644)
		if err != nil {
			return xerrors.Errorf("cannot encode config.json: %w", err)
		}
	}
	exec := func() error {
		err = syscall.Exec(runcPath, os.Args, os.Environ())
		if err == nil {
			return nil
		} else {
			log.WithError(err).Warn("runc failed")
			return err
		}
	}

	err = exec()
	if err != nil {
		retry, err := LookUpRetryCount()
		if err != nil {
			return err
		}
		for i := 0; i <= retry-1; i++ {
			err = exec()
			if err == nil {
				return nil
			}
		}
	} else {
		return nil
	}

	// See here for more details on why retries are necessary.
	// https://github.com/gitpod-io/gitpod/issues/12365
	return xerrors.Errorf("exec %s: %w", runcPath, err)
}

func LookUpRetryCount() (int, error) {
	userArgs, exists := os.LookupEnv(DaemonArgs)
	if !exists {
		return DEFAULT_RETRY, nil
	}

	var providedDockerArgs map[string]string
	if err := json.Unmarshal([]byte(userArgs), &providedDockerArgs); err != nil {
		return 0, xerrors.Errorf("unable to deserialize docker args: %w", err)
	}

	v, ok := providedDockerArgs["runc-retry"]
	if !ok {
		return DEFAULT_RETRY, nil
	}

	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, err
	}
	return n, nil
}
