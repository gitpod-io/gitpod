// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/kedge/pkg/kedge"
	"github.com/gitpod-io/gitpod/kedge/pkg/registration"
	"github.com/spf13/cobra"
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts a kedge endpoint and collects services from others",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := getConfig()
		if err != nil {
			log.WithError(err).Fatal("cannot get config")
		}

		clientset, err := kedge.NewClientSet(cfg.Kubeconfig)
		if err != nil {
			log.WithError(err).Fatal("cannot connect to kubernetes")
		}

		var notifier registration.CompositeNotifier
		for _, nf := range cfg.Notifications {
			notifier = append(notifier, registration.NewHTTPServiceNotifier(nf.URL, nf.Token, time.Duration(nf.Timeout)))
		}

		var store registration.Store = registration.EmptyStore{}
		if cfg.Registration.Enabled {
			store, err = registration.NewKubernetesStore(clientset, cfg.Namespace, "kedge-store")
			if err != nil {
				log.WithError(err).Fatal("cannot setup registration store")
			}
		}

		log.Info("removing legacy workspaces")
		err = kedge.ClearLegacyServices(clientset, cfg.Namespace)
		if err != nil {
			log.WithError(err).Fatal("cannot remove all legacy workspaces")
		}

		pool := registration.CollectorPool{
			Clientset:           clientset,
			Namespace:           cfg.Namespace,
			StaticCollectors:    cfg.Collection.StaticCollection,
			Store:               store,
			ServiceNotifier:     notifier,
			FailureTTLService:   cfg.Collection.FailureTTLService,
			FailureTTLCollector: cfg.Collection.FailureTTLCollector,
		}
		go pool.Start(time.Duration(cfg.Collection.Period))

		mux := &http.ServeMux{}
		if cfg.Registration.Enabled {
			token := cfg.Token
			if cfg.Registration.Token != "" {
				token = cfg.Registration.Token
			}

			regsrv := registration.Server{
				Token: token,
				OnNewCollector: func(c kedge.Collector) error {
					err := pool.AddCollector(c)
					if err != nil {
						log.WithError(err).Warn("cannot add new collector")
						return err
					}
					return nil
				},
			}
			regsrv.Routes(mux)
		}
		srv := kedge.EndpointServer{
			Clientset: clientset,
			Token:     cfg.Token,
			Services:  cfg.Services,
			Namespace: cfg.Namespace,
		}
		srv.Routes(mux)
		go func() {
			s := &http.Server{
				Addr:         fmt.Sprintf(":%d", cfg.Port),
				Handler:      mux,
				WriteTimeout: 60 * time.Second,
				ReadTimeout:  10 * time.Second,
			}

			log.WithField("addr", fmt.Sprintf(":%d", srv.Port)).Debug("HTTP server listening")
			log.Fatal(s.ListenAndServe())
		}()

		log.WithField("period", cfg.Collection.Period.String()).Info("⚓ kedge is up and running")

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
