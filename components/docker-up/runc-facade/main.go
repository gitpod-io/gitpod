// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"syscall"

	"github.com/opencontainers/runtime-spec/specs-go"
	"github.com/sirupsen/logrus"
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
		return fmt.Errorf("cannot read config.json: %w", err)
	}

	var cfg specs.Spec
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return fmt.Errorf("cannot decode config.json: %w", err)
	}

	cfg.Process.OOMScoreAdj = &defaultOOMScoreAdj
	replaceSysMount(&cfg)

	fc, err = json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("cannot encode config.json: %w", err)
	}
	for _, fn := range []string{"config.json", "/tmp/debug.json"} {
		err = os.WriteFile(fn, fc, 0644)
		if err != nil {
			return fmt.Errorf("cannot encode config.json: %w", err)
		}
	}

	err = syscall.Exec(runcPath, os.Args, os.Environ())
	if err != nil {
		return fmt.Errorf("exec %s: %w", runcPath, err)
	}
	return nil
}

func replaceSysMount(cfg *specs.Spec) {
	var n int
	for _, m := range cfg.Mounts {
		if m.Destination == "/sys" {
			continue
		}

		cfg.Mounts[n] = m
		n++
	}

	cfg.Mounts = cfg.Mounts[:n]
	cfg.Mounts = append(cfg.Mounts, specs.Mount{
		Destination: "/sys",
		Options: []string{
			"rbind",
			"rprivate",
		},
		Source: "/sys",
		Type:   "bind",
	})
}
