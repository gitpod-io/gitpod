// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"syscall"
	"time"

	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/timestamppb"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/loadgen/pkg/loadgen"
	"github.com/gitpod-io/gitpod/loadgen/pkg/observer"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

var runOpts struct {
	TLSPath     string
	Interactive bool
}

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "runs the load generator",
	Run: func(cmd *cobra.Command, args []string) {
		const workspaceCount = 5

		var load loadgen.LoadGenerator
		load = loadgen.NewFixedLoadGenerator(500*time.Millisecond, 300*time.Millisecond)
		load = loadgen.NewWorkspaceCountLimitingGenerator(load, workspaceCount)

		template := &api.StartWorkspaceRequest{
			Id: "will-be-overriden",
			Metadata: &api.WorkspaceMetadata{
				MetaId:    "will-be-overriden",
				Owner:     "00000000-0000-0000-0000-000000000000",
				StartedAt: timestamppb.Now(),
			},
			ServicePrefix: "will-be-overriden",
			Spec: &api.StartWorkspaceSpec{
				DeprecatedIdeImage: "eu.gcr.io/gitpod-core-dev/build/ide/code:commit-8c1466008dedabe79d82cbb91931a16f7ce7994c",
				IdeImage: &api.IDEImage{
					WebRef: "eu.gcr.io/gitpod-core-dev/build/ide/code:commit-8c1466008dedabe79d82cbb91931a16f7ce7994c",
				},
				Admission: api.AdmissionLevel_ADMIT_OWNER_ONLY,
				Git: &api.GitSpec{
					Email:    "test@gitpod.io",
					Username: "foobar",
				},
				FeatureFlags: []api.WorkspaceFeatureFlag{},
				Initializer: &csapi.WorkspaceInitializer{
					Spec: &csapi.WorkspaceInitializer_Git{
						Git: &csapi.GitInitializer{
							CheckoutLocation: "gitpod",
							CloneTaget:       "main",
							RemoteUri:        "https://github.com/gitpod-io/gitpod.git",
							TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
							Config: &csapi.GitConfig{
								Authentication: csapi.GitAuthMethod_NO_AUTH,
							},
						},
					},
				},
				Timeout:           "5m",
				WorkspaceImage:    "eu.gcr.io/gitpod-dev/workspace-images:3fcaad7ba5a5a4695782cb4c366b82f927f1e6c1cf0c88fd4f14d985f7eb21f6",
				WorkspaceLocation: "gitpod",
				Envvars: []*api.EnvironmentVariable{
					{
						Name:  "THEIA_SUPERVISOR_TOKENS",
						Value: `[{"token":"foobar","host":"gitpod-staging.com","scope":["function:getWorkspace","function:getLoggedInUser","function:getPortAuthenticationToken","function:getWorkspaceOwner","function:getWorkspaceUsers","function:isWorkspaceOwner","function:controlAdmission","function:setWorkspaceTimeout","function:getWorkspaceTimeout","function:sendHeartBeat","function:getOpenPorts","function:openPort","function:closePort","function:generateNewGitpodToken","function:takeSnapshot","function:stopWorkspace","resource:workspace::fa498dcc-0a84-448f-9666-79f297ad821a::get/update","resource:workspaceInstance::e0a17083-6a78-441a-9b97-ef90d6aff463::get/update/delete","resource:snapshot::*::create/get","resource:gitpodToken::*::create","resource:userStorage::*::create/get/update"],"expiryDate":"2020-12-01T07:55:12.501Z","reuse":2}]`,
					},
				},
			},
			Type: api.WorkspaceType_REGULAR,
		}

		var opts []grpc.DialOption
		if runOpts.TLSPath != "" {
			ca, err := ioutil.ReadFile(filepath.Join(runOpts.TLSPath, "ca.crt"))
			if err != nil {
				log.Fatal(err)
			}
			capool := x509.NewCertPool()
			capool.AppendCertsFromPEM(ca)
			cert, err := tls.LoadX509KeyPair(filepath.Join(runOpts.TLSPath, "tls.crt"), filepath.Join(runOpts.TLSPath, "tls.key"))
			if err != nil {
				log.Fatal(err)
			}
			creds := credentials.NewTLS(&tls.Config{
				Certificates: []tls.Certificate{cert},
				RootCAs:      capool,
				ServerName:   "ws-manager",
			})
			opts = append(opts, grpc.WithTransportCredentials(creds))
		} else {
			opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
		}

		sessionID := uuid.New().String()
		resultsDir := fmt.Sprintf("results/run-%s", sessionID)
		if err := os.MkdirAll(resultsDir, 0755); err != nil {
			log.Fatal(err)
		}
		log.Infof("Results will be saved in dir %s", resultsDir)

		conn, err := grpc.Dial("localhost:8080", opts...)
		if err != nil {
			log.Fatal(err)
		}
		defer conn.Close()
		client := api.NewWorkspaceManagerClient(conn)
		executor := &loadgen.WsmanExecutor{
			C:         client,
			SessionId: sessionID,
		}

		session := &loadgen.Session{
			Executor: executor,
			Load:     load,
			Specs:    &loadgen.FixedWorkspaceGenerator{Template: template},
			Worker:   5,
			Observer: []chan<- *loadgen.SessionEvent{
				observer.NewLogObserver(true),
				observer.NewProgressBarObserver(workspaceCount),
				observer.NewStatsObserver(func(s *observer.Stats) {
					fc, err := json.Marshal(s)
					if err != nil {
						return
					}
					os.WriteFile(path.Join(resultsDir, "stats.json"), fc, 0644)
				}),
			},
			PostLoadWait: func() {
				log.Info("load generation complete - press Ctrl+C to finish of")
				<-make(chan struct{})
			},
		}

		sctx, scancel := context.WithCancel(context.Background())
		go func() {
			sigc := make(chan os.Signal, 1)
			signal.Notify(sigc, syscall.SIGINT)
			<-sigc
			scancel()
			os.Exit(0)
		}()

		err = session.Run(sctx)
		if err != nil {
			log.WithError(err).Fatal()
		}

	},
}

func init() {
	rootCmd.AddCommand(runCmd)

	runCmd.Flags().StringVar(&runOpts.TLSPath, "tls", "", "path to ws-manager's TLS certificates")
}
