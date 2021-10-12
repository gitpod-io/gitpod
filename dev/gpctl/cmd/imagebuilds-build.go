// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	builder "github.com/gitpod-io/gitpod/image-builder/api"
)

// imagebuildsBuildCmd represents the build command
var imagebuildsBuildCmd = &cobra.Command{
	Use:   "build <source.json>",
	Short: "Runs a full workspace image build",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fc, err := os.ReadFile(args[0])
		if err != nil {
			log.Fatal(err)
		}

		var example builder.BuildSource
		example.From = &builder.BuildSource_File{
			File: &builder.BuildSourceDockerfile{
				DockerfilePath: "Dockerfile",
				ContextPath:    ".",
				Source: &csapi.WorkspaceInitializer{
					Spec: &csapi.WorkspaceInitializer_Git{
						Git: &csapi.GitInitializer{
							RemoteUri:        "https://github.com/32leaves/test-repo",
							TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
							CloneTaget:       "test-baseimg",
							CheckoutLocation: ".",
							Config: &csapi.GitConfig{
								Authentication: csapi.GitAuthMethod_NO_AUTH,
							},
						},
					},
				},
			},
		}

		marshaler := protojson.MarshalOptions{
			Indent: "  ",
		}

		b, _ := marshaler.Marshal(&example)
		fmt.Println("example config:")
		fmt.Fprint(os.Stdout, string(b))
		fmt.Println()

		var source builder.BuildSource
		err = protojson.Unmarshal(fc, &source)
		if err != nil {
			log.Fatal(err)
		}
		b, _ = marshaler.Marshal(&source)
		fmt.Println("actual config:")
		fmt.Fprint(os.Stdout, string(b))
		fmt.Println()

		forceRebuild, _ := cmd.Flags().GetBool("force-rebuild")

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getImagebuildsClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		br, err := client.Build(ctx, &builder.BuildRequest{
			Source:       &source,
			ForceRebuild: forceRebuild,
			Auth:         &builder.BuildRegistryAuth{Mode: &builder.BuildRegistryAuth_Total{Total: &builder.BuildRegistryAuthTotal{AllowAll: true}}},
		})
		if err != nil {
			log.Fatal(err)
		}
		r, err := br.Recv()
		if err != nil {
			log.Fatal(err)
		}
		log.WithField("r", r).Info("received build response")

		switch r.Status {
		case builder.BuildStatus_done_failure, builder.BuildStatus_done_success:
			log.Infof("build done: %s", builder.BuildStatus_name[int32(r.Status)])
			return
		case builder.BuildStatus_unknown:
			log.Fatal("build status unknown")
			return
		}

		// build did start, print log until done
		censor, _ := cmd.Flags().GetBool("censor")
		lc, err := client.Logs(ctx, &builder.LogsRequest{
			BuildId:  r.Info.BuildId,
			BuildRef: r.Ref,
			Censored: censor,
		})
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}
		log.Info("listening for build logs")
		buildMessage, logs := make(chan *builder.BuildResponse), make(chan []byte)
		go func() {
			r, err := br.Recv()
			if err != nil {
				if err != io.EOF {
					log.Fatal(err)
				} else {
					log.Info("logs ended")
				}

				return
			}
			buildMessage <- r
		}()
		go func() {
			for {
				l, err := lc.Recv()
				if err == io.EOF {
					break
				}
				if err != nil {
					log.WithError(err).Fatal("recv err")
				}
				logs <- l.Content
			}
		}()

		for {
			select {
			case bm := <-buildMessage:
				log.Print(bm)
				switch bm.Status {
				case builder.BuildStatus_done_failure, builder.BuildStatus_done_success:
					log.Infof("build done: %s", builder.BuildStatus_name[int32(bm.Status)])
					return
				case builder.BuildStatus_unknown:
					log.Fatal("build status unknown")
					return
				}
			case logdata := <-logs:
				// fmt.Fprint(log.Log.Writer(), string(logdata))
				fmt.Print(string(logdata))
			}
		}
	},
}

func init() {
	imagebuildsCmd.AddCommand(imagebuildsBuildCmd)

	imagebuildsBuildCmd.Flags().Bool("censor", false, "censor the log output")
	imagebuildsBuildCmd.Flags().Bool("force-rebuild", false, "force an image build even if the image exists already")
}
