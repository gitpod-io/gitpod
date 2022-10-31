// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/opencontainers/runtime-spec/specs-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

const RETRY = 3

func main() {
	log := logrus.New()
	log.SetLevel(logrus.DebugLevel)

	var (
		candidates = []string{"bob-runc", "runc"}
		runcPath   string
		bundle     string
		err        error
	)
	for _, c := range candidates {
		runcPath, err = exec.LookPath(c)
		if runcPath != "" {
			break
		}
	}
	if err != nil {
		log.WithError(err).Fatal("runc not found")
	}

	var useFacade bool
	for i, arg := range os.Args {
		if arg == "run" {
			useFacade = true
		}
		if arg == "--bundle" && i+1 < len(os.Args) {
			bundle = os.Args[i+1]
		}
	}

	if useFacade && bundle != "" {
		err = createAndRunc(runcPath, bundle)
	} else {
		err = syscall.Exec(runcPath, os.Args, os.Environ())
	}
	if err != nil {
		log.WithError(err).Fatal("failed")
	}
}

func createAndRunc(runcPath, bundle string) error {
	fn := filepath.Join(bundle, "config.json")
	fc, err := os.ReadFile(fn)
	if err != nil {
		return xerrors.Errorf("cannot read config.json: %w", err)
	}

	var cfg specs.Spec
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return xerrors.Errorf("cannot decode config.json: %w", err)
	}

	var hasSysMount bool
	for _, m := range cfg.Mounts {
		if m.Destination == "/sys" {
			hasSysMount = true
			break
		}
	}
	if !hasSysMount {
		cfg.Mounts = append(cfg.Mounts, specs.Mount{
			Destination: "/sys",
			Type:        "sysfs",
			Source:      "sysfs",
		})
	}

	fc, err = json.Marshal(cfg)
	if err != nil {
		return xerrors.Errorf("cannot encode config.json: %w", err)
	}
	for _, fn := range []string{fn, "/tmp/debug.json"} {
		err = os.WriteFile(fn, fc, 0644)
		if err != nil {
			return xerrors.Errorf("cannot encode config.json: %w", err)
		}
	}

	// See here for more details on why retries are necessary.
	// https://github.com/gitpod-io/gitpod/issues/12365
	for i := 0; i <= RETRY; i++ {
		err = syscall.Exec(runcPath, os.Args, os.Environ())
		if err == nil {
			return err
		} else {
			log.WithError(err).Warn("runc failed")
		}
	}

	return xerrors.Errorf("exec %s: %w", runcPath, err)
}
