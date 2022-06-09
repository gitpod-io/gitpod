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

func (db DockerBuilder) BuildImage(logs io.WriteCloser, ref string, cfg *gitpod.GitpodConfig) (err error) {
	tmpdir, err := os.MkdirTemp("", "rungp-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpdir)

	// df := `
	// FROM $SUPERVISOR AS supervisor
	// FROM $WEBIDE AS webide

	// $BASEIMAGE

	// COPY --from=supervisor /.supervisor /.supervisor/
	// COPY --from=webide /ide /ide/

	// USER root
	// RUN sed -e 's#_supervisor/frontend/main.js#_supervisor/frontend/rungp.js#g' /ide/out/vs/gitpod/browser/workbench/workbench.html > /tmp/d && mv /tmp/d /ide/out/vs/gitpod/browser/workbench/workbench.html
	// `
	df := `
	FROM $SUPERVISOR AS supervisor
	FROM $WEBIDE AS webide
	FROM --platform=linux/amd64 docker.io/gitpod/openvscode-server AS openvscode

	$BASEIMAGE

	COPY --from=supervisor /.supervisor /.supervisor/
	COPY --from=openvscode --chown=33333:33333 /home/.openvscode-server /ide/
	COPY --from=webide --chown=33333:33333 /ide/startup.sh /ide/codehelper /ide/
	RUN echo '{"entrypoint": "/ide/startup.sh", "entrypointArgs": [ "--port", "{IDEPORT}", "--host", "0.0.0.0", "--without-connection-token", "--server-data-dir", "/workspace/.vscode-remote" ]}' > /ide/supervisor-ide-config.json && \
		(echo '#!/bin/bash -li'; echo 'cd /ide || exit'; echo 'exec /ide/codehelper "$@"') > /ide/startup.sh && \
		chmod +x /ide/startup.sh && \
		mv /ide/bin/openvscode-server /ide/bin/gitpod-code

	USER root
	`
	df = strings.ReplaceAll(df, "$SUPERVISOR", db.Images.Supervisor)
	df = strings.ReplaceAll(df, "$WEBIDE", db.Images.WebIDE)

	var baseimage string
	switch {
	case cfg.Image == nil:
		baseimage = "FROM gitpod/workspace-full:latest"
	case cfg.Image.Ref != "":
		baseimage = "FROM " + cfg.Image.Ref
	default:
		fc, err := ioutil.ReadFile(filepath.Join(db.Workdir, cfg.Image.Obj.Context, cfg.Image.Obj.File))
		if err != nil {
			// TODO(cw): make error actionable
			return err
		}
		baseimage = "\n" + string(fc) + "\n"
	}
	df = strings.ReplaceAll(df, "$BASEIMAGE", baseimage)

	err = ioutil.WriteFile(filepath.Join(tmpdir, "Dockerfile"), []byte(df), 0644)
	if err != nil {
		return err
	}

	cmd := exec.Command("docker", "build", "-t", ref, "--pull=false", ".")
	cmd.Dir = tmpdir
	cmd.Stdout = logs
	cmd.Stderr = logs
	err = cmd.Run()
	if _, ok := err.(*exec.ExitError); ok {
		return fmt.Errorf("workspace image build failed")
	} else if err != nil {
		return err
	}

	return nil
}

func (db DockerBuilder) BuildBaseImage(logs io.WriteCloser, ref string, cfg gitpod.ImageObject) (err error) {
	defer logs.Close()

	context := filepath.Join(db.Workdir, cfg.Context)
	cmd := exec.Command("docker", "build", "-f", cfg.File, "-t", ref, ".")
	cmd.Dir = context
	cmd.Stdout = logs
	cmd.Stderr = logs
	err = cmd.Run()
	if _, ok := err.(*exec.ExitError); ok {
		return fmt.Errorf("base build failed")
	} else if err != nil {
		return err
	}

	cmd = exec.Command("docker", "push", ref)
	cmd.Dir = context
	cmd.Stdout = logs
	cmd.Stderr = logs
	err = cmd.Run()
	if _, ok := err.(*exec.ExitError); ok {
		return fmt.Errorf("base build failed")
	} else if err != nil {
		return err
	}

	return nil
}

func (db DockerBuilder) BuildWorkspaceImage(logs io.WriteCloser, ref string, base string) (err error) {
	tmpdir, err := os.MkdirTemp("", "rungp-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpdir)

	df := `
	FROM $SUPERVISOR AS supervisor
	FROM $WEBIDE AS webide

	FROM $BASEREF
	COPY --from=supervisor /.supervisor /.supervisor/
	COPY --from=webide /ide /ide/
	`
	df = strings.ReplaceAll(df, "$SUPERVISOR", db.Images.Supervisor)
	df = strings.ReplaceAll(df, "$WEBIDE", db.Images.WebIDE)
	df = strings.ReplaceAll(df, "$BASEREF", base)

	err = ioutil.WriteFile(filepath.Join(tmpdir, "Dockerfile"), []byte(df), 0644)
	if err != nil {
		return err
	}

	cmd := exec.Command("docker", "build", "-t", ref, "--pull=false", ".")
	cmd.Dir = tmpdir
	cmd.Stdout = logs
	cmd.Stderr = logs
	err = cmd.Run()
	if _, ok := err.(*exec.ExitError); ok {
		return fmt.Errorf("workspace image build failed")
	} else if err != nil {
		return err
	}

	return nil
}
