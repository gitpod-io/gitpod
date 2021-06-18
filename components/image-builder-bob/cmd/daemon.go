// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/builder"

	"github.com/containerd/console"
	"github.com/moby/buildkit/client"
	"github.com/moby/buildkit/client/llb"
	"github.com/moby/buildkit/util/progress/progressui"
	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"
)

// daemonCmd represents the build command
var daemonCmd = &cobra.Command{
	Use:   "daemon <socket-path>",
	Short: "Starts a buildkitd and pre-caches images",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		if os.Geteuid() != 0 {
			log.Fatal("must run as root")
		}

		skt := args[0]
		cl, teardown, err := builder.StartBuildkit(skt)
		if err != nil {
			log.WithError(err).Fatal("cannot start daemon")
		}
		defer teardown()

		rawimgs := os.Getenv("BOB_CACHE_IMAGES")
		if rawimgs != "" {
			var images []string
			err = json.Unmarshal([]byte(rawimgs), &images)
			if err != nil {
				log.WithError(err).Error("cannot unmarshal BOB_CACHE_IMAGES")
			}

			if len(images) > 0 {
				err = prewarmCache(cl, images)
				if err != nil {
					log.WithError(err).Error("cannot prewarm cache")
				}
			}
		}

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("👷 image-builder daemon is up and running. Stop with SIGINT or CTRL+C")
		<-sigChan
		log.Info("Received SIGINT - shutting down")
	},
}

func prewarmCache(cl *client.Client, images []string) error {
	for _, img := range images {
		bld := llb.Image(img).Run(llb.Shlex("echo"))
		for idx, img := range images {
			bld = bld.AddMount(fmt.Sprintf("/mnt/%03d", idx), llb.Image(img)).Run(llb.Shlex("echo"))
		}
		pulllb, err := bld.Marshal(context.Background())
		if err != nil {
			log.WithError(err).Fatal("cannot produce image pull LLB")
		}

		log.Info("pulling images")
		var (
			ch      = make(chan *client.SolveStatus)
			eg, ctx = errgroup.WithContext(context.Background())
		)
		eg.Go(func() error {
			_, err := cl.Solve(ctx, pulllb, client.SolveOpt{}, ch)
			return err
		})
		eg.Go(func() error {
			var c console.Console
			// not using shared context to not disrupt display but let is finish reporting errors
			return progressui.DisplaySolveStatus(context.TODO(), "", c, os.Stderr, ch)
		})
		err = eg.Wait()
		if err != nil {
			return err
		}
	}
	log.Info("done pulling images")
	return nil
}

func init() {
	rootCmd.AddCommand(daemonCmd)
}
