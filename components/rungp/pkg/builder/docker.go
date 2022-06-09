// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

type DockerBuilder struct {
	Workdir string
	Images  GitpodImages
}

func (db DockerBuilder) BuildBaseImage(logs io.WriteCloser, cfg gitpod.ImageObject) (ref string, err error) {

	defer logs.Close()

	tag := "workspace-base:latest"

	context := filepath.Join(db.Workdir, cfg.Context)
	cmd := exec.Command("docker", "build", "-f", cfg.File, "-t", tag, ".")
	cmd.Dir = context
	cmd.Stdout = logs
	cmd.Stderr = logs
	err = cmd.Run()
	if _, ok := err.(*exec.ExitError); ok {
		return "", fmt.Errorf("base build failed")
	} else if err != nil {
		return "", err
	}

	return tag, nil
}

func (db DockerBuilder) BuildWorkspaceImage(logs io.WriteCloser, base string) (ref string, err error) {
	tmpdir, err := os.MkdirTemp("", "rungp-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpdir)

	df := `
	FROM $SUPERVISOR AS supervisor
	FROM $WEBIDE AS webide

	FROM $BASEREF
	COPY --from=supervisor /.supervisor /
	COPY --from=webide /ide /
	`
	df = strings.ReplaceAll(df, "$SUPERVISOR", db.Images.Supervisor)
	df = strings.ReplaceAll(df, "$WEBIDE", db.Images.WebIDE)
	df = strings.ReplaceAll(df, "$BASEREF", base)

	err = ioutil.WriteFile(filepath.Join(tmpdir, "Dockerfile"), []byte(df), 0644)
	if err != nil {
		return "", err
	}

	tag := "workspace-image:latest"

	cmd := exec.Command("docker", "build", "-t", tag, ".")
	cmd.Dir = tmpdir
	cmd.Stdout = logs
	cmd.Stderr = logs
	err = cmd.Run()
	if _, ok := err.(*exec.ExitError); ok {
		return "", fmt.Errorf("workspace image build failed")
	} else if err != nil {
		return "", err
	}

	return "", nil
}
