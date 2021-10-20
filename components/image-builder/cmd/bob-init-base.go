// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	securejoin "github.com/cyphar/filepath-securejoin"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/image-builder/api"
)

// bobInitBase represents the init command
var bobInitBase = &cobra.Command{
	Use:   "init-base <location> <base64:source>",
	Short: "Assembles the base image context of a build.",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		wd := args[0]
		inpt := args[1]

		rawinit, err := base64.StdEncoding.DecodeString(inpt)
		if err != nil {
			log.Fatalf("cannot decode initializer: %v", err)
		}

		var src api.BuildSourceDockerfile
		err = proto.Unmarshal(rawinit, &src)
		if err != nil {
			log.Fatalf("cannot unmarshal initializer: %v", err)
		}

		initwd := filepath.Join(wd, "init")

		ctx := context.Background()
		rms := &storage.DirectNoopStorage{}
		ilr, err := initializer.NewFromRequest(ctx, initwd, rms, src.Source, initializer.NewFromRequestOpts{ForceGitpodUserForGit: false})
		if err != nil {
			log.Fatalf("cannot create initializer: %v", err)
		}

		_, err = initializer.InitializeWorkspace(ctx, initwd, rms, initializer.WithInitializer(ilr), initializer.WithCleanSlate)
		if err != nil {
			log.WithError(err).Fatal("init failed")
		}

		ctxwd := filepath.Join(wd, "context")
		err = os.MkdirAll(ctxwd, 0755)
		if err != nil {
			log.WithError(err).Fatal("init failed")
		}
		err = os.Chown(ctxwd, 33333, 33333)
		if err != nil {
			log.WithError(err).Fatal("init failed")
		}

		initctx, err := securejoin.SecureJoin(initwd, src.ContextPath)
		if err != nil {
			log.WithError(err).Fatal("init failed")
		}
		if stat, err := os.Stat(initctx); os.IsNotExist(err) {
			log.Fatalf("Context directory \"%s\" does not exist", initctx)
		} else if err != nil {
			log.Fatalf("Context directory error: %v", err)
		} else if !stat.IsDir() {
			log.Fatalf("Context path \"%s\" is not a directory", initctx)
		}

		initdf, err := securejoin.SecureJoin(initwd, src.DockerfilePath)
		if err != nil {
			log.WithError(err).Fatal("init failed")
		}
		if stat, err := os.Stat(initdf); os.IsNotExist(err) {
			log.Fatalf("Dockerfile \"%s\" does not exist", initdf)
		} else if err != nil {
			log.Fatalf("Dockerfile error: %v", err)
		} else if stat.IsDir() {
			log.Fatalf("Dockerfile \"%s\" is a directory", src.DockerfilePath)
		}

		var cmds [][]string
		cmds = append(cmds, []string{"sh", "-c", fmt.Sprintf("cp -Rf %s/. .", initctx)})
		cmds = append(cmds, []string{"mv", "-f", initdf, "Dockerfile"})

		for _, cmd := range cmds {
			c := exec.Command(cmd[0], cmd[1:]...)
			c.Dir = ctxwd
			c.Stdout = log.Log.WriterLevel(logrus.InfoLevel)
			c.Stderr = log.Log.WriterLevel(logrus.ErrorLevel)
			_ = c.Run()
		}
	},
}

func init() {
	bobCmd.AddCommand(bobInitBase)
}
