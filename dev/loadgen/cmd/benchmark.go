// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"io/ioutil"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"golang.org/x/net/context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/protobuf/types/known/timestamppb"
	"sigs.k8s.io/yaml"

	"github.com/gitpod-io/gitpod/loadgen/pkg/loadgen"
	"github.com/gitpod-io/gitpod/loadgen/pkg/observer"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

var benchmarkOpts struct {
	TLSPath string
	Host    string
}

// benchmarkCommand represents the run command
var benchmarkCommand = &cobra.Command{
	Use:   "benchmark <scenario.yaml>",
	Short: "starts a bunch of workspaces for benchmarking startup time",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fn := args[0]
		fc, err := ioutil.ReadFile(fn)
		if err != nil {
			log.WithError(err).WithField("fn", fn).Fatal("cannot read scenario file")
		}
		var scenario BenchmarkScenario
		err = yaml.Unmarshal(fc, &scenario)
		if err != nil {
			log.WithError(err).WithField("fn", fn).Fatal("cannot unmarshal scenario file")
		}

		var load loadgen.LoadGenerator
		load = loadgen.NewFixedLoadGenerator(500*time.Millisecond, 300*time.Millisecond)
		load = loadgen.NewWorkspaceCountLimitingGenerator(load, scenario.Workspaces)

		template := &api.StartWorkspaceRequest{
			Id: "will-be-overriden",
			Metadata: &api.WorkspaceMetadata{
				MetaId:    "will-be-overriden",
				Owner:     "c0f5dbf1-8d50-4d2a-8cd9-fe563fa53c71",
				StartedAt: timestamppb.Now(),
			},
			ServicePrefix: "will-be-overriden",
			Spec: &api.StartWorkspaceSpec{
				DeprecatedIdeImage: scenario.IDEImage,
				IdeImage: &api.IDEImage{
					WebRef: scenario.IDEImage,
				},
				Admission: api.AdmissionLevel_ADMIT_OWNER_ONLY,
				Git: &api.GitSpec{
					Email:    "test@gitpod.io",
					Username: "foobar",
				},
				FeatureFlags:      []api.WorkspaceFeatureFlag{},
				Timeout:           "5m",
				WorkspaceImage:    "will-be-overriden",
				WorkspaceLocation: "workspace-stress",
				Envvars:           scenario.Environment,
			},
			Type: api.WorkspaceType_REGULAR,
		}

		var opts []grpc.DialOption
		if benchmarkOpts.TLSPath != "" {
			ca, err := ioutil.ReadFile(filepath.Join(benchmarkOpts.TLSPath, "ca.crt"))
			if err != nil {
				log.Fatal(err)
			}
			capool := x509.NewCertPool()
			capool.AppendCertsFromPEM(ca)
			cert, err := tls.LoadX509KeyPair(filepath.Join(benchmarkOpts.TLSPath, "tls.crt"), filepath.Join(benchmarkOpts.TLSPath, "tls.key"))
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
			opts = append(opts, grpc.WithInsecure())
		}

		conn, err := grpc.Dial(benchmarkOpts.Host, opts...)
		if err != nil {
			log.Fatal(err)
		}
		defer conn.Close()

		d, err := time.ParseDuration(scenario.RunningTimeout)
		if err != nil {
			log.Fatal(err)
		}

		success := observer.NewSuccessObserver()

		session := &loadgen.Session{
			Executor: &loadgen.WsmanExecutor{C: api.NewWorkspaceManagerClient(conn)},
			// Executor: loadgen.NewFakeExecutor(),
			Load: load,
			Specs: &loadgen.MultiWorkspaceGenerator{
				Template: template,
				Repos:    scenario.Repos,
			},
			Worker: 5,
			Observer: []chan<- *loadgen.SessionEvent{
				observer.NewLogObserver(true),
				observer.NewProgressBarObserver(scenario.Workspaces),
				observer.NewStatsObserver(func(s *observer.Stats) {
					fc, err := json.Marshal(s)
					if err != nil {
						return
					}
					os.WriteFile("stats.json", fc, 0644)
				}),
				success.Observe(),
			},
			PostLoadWait: func() {
				ctx, cancel := context.WithTimeout(context.Background(), d)
				defer cancel()

				log.Info("Waiting for workspaces to enter running phase")
				if err := success.Wait(ctx, scenario.Workspaces); err != nil {
					log.Errorf("%v", err)
					log.Info("load generation did not complete successfully - press Ctrl+C to finish of")
				} else {
					log.Info("load generation completed successfully - press Ctrl+C to finish of")
				}
				<-make(chan struct{})
			},
		}

		go func() {
			sigc := make(chan os.Signal, 1)
			signal.Notify(sigc, syscall.SIGINT)
			<-sigc
			os.Exit(0)
		}()

		err = session.Run()
		if err != nil {
			log.WithError(err).Fatal()
		}

	},
}

func init() {
	rootCmd.AddCommand(benchmarkCommand)

	benchmarkCommand.Flags().StringVar(&benchmarkOpts.TLSPath, "tls", "", "path to ws-manager's TLS certificates")
	benchmarkCommand.Flags().StringVar(&benchmarkOpts.Host, "host", "localhost:8080", "ws-manager host to talk to")
}

type BenchmarkScenario struct {
	Workspaces     int                        `json:"workspaces"`
	IDEImage       string                     `json:"ideImage"`
	Repos          []loadgen.WorkspaceCfg     `json:"repos"`
	Environment    []*api.EnvironmentVariable `json:"environment"`
	RunningTimeout string                        `json:"waitForRunning"`
}
