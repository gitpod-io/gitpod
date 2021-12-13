// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
)

// runCmd represents the run command
func run(args []string) error {
	if len(args) > 0 && args[0] == "ring1" {
		self, err := os.Executable()
		if err != nil {
			return err
		}
		err = os.Symlink(self, "supervisor")
		if err != nil && !os.IsExist(err) {
			return err
		}

		cmd := exec.Command("supervisor", "run")
		cmd.Stdout = os.Stdout
		cmd.Stdin = os.Stdin
		cmd.Stderr = os.Stderr
		err = cmd.Run()
		if err != nil {
			return err
		}

		return nil
	}

	if len(args) > 0 && args[0] == "run" {
		var err error
		cmd := exec.Command("bash")
		cmd.Stdout = os.Stdout
		cmd.Stdin = os.Stdin
		cmd.Stderr = os.Stderr
		err = cmd.Run()
		if err != nil {
			return err
		}
		return nil
	}

	if len(args) > 0 && args[0] == "start" {
		cwd, err := os.Getwd()
		if err != nil {
			return err
		}
		env := os.Environ()
		for i, e := range env {
			if strings.HasPrefix(e, "PATH=") {
				env[i] += e + ":" + cwd
			}
		}
		env = append(env, "GITPOD_OWNER_ID=owner-id", "GITPOD_WORKSPACE_ID=workspace-id", "GITPOD_INSTANCE_ID=instance-id", "GITPOD_WORKSPACE_CONTEXT_URL=https://github.com/gitpod-io/gitpod")

		cmd := exec.Command("/proc/self/exe", "ring1")
		cmd.Stdout = os.Stdout
		cmd.Stdin = os.Stdin
		cmd.Stderr = os.Stderr
		cmd.Env = env
		err = cmd.Run()
		if err != nil {
			return err
		}
	}

	fmt.Println("run with \"testbed start\"")

	return nil
}

func main() {
	err := run(os.Args[1:])
	if err != nil {
		log.Fatal(err)
	}
}
