// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"syscall"

	"github.com/opencontainers/runtime-spec/specs-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

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
		err = createAndRunc(runcPath)
	} else {
		err = syscall.Exec(runcPath, os.Args, os.Environ())
	}
	if err != nil {
		log.WithError(err).Fatal("failed")
	}
}

func createAndRunc(runcPath string) error {
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

	err = syscall.Exec(runcPath, os.Args, os.Environ())
	if err != nil {
		return xerrors.Errorf("exec %s: %w", runcPath, err)
	}
	return nil
}
