// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"math/rand"
	"os"
	"os/signal"
	"syscall"

	"github.com/Pallinder/go-randomdata"
	toxiproxy "github.com/Shopify/toxiproxy/client"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/gitpod-io/gitpod/blowtorch/pkg/dart"
)

var ablazeCmd = &cobra.Command{
	Use:   "ablaze",
	Short: "Adds a toxiproxy intermediate for a random service, adds some random toxics and restarts all pods",
	Args:  cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		cfg, ns, err := getKubeconfig()
		if err != nil {
			log.WithError(err).Fatal("cannot get Kubernetes client config")
		}

		client, err := kubernetes.NewForConfig(cfg)
		if err != nil {
			log.WithError(err).Fatal("cannot connect to Kubernetes")
		}

		services, err := client.CoreV1().Services(ns).List(context.Background(), metav1.ListOptions{})
		if err != nil {
			log.WithError(err).Fatal("cannot list services")
		}
		if len(services.Items) == 0 {
			log.WithError(err).Fatal("no services available")
		}
		srv := services.Items[rand.Intn(len(services.Items))]
		targetService := srv.Name
		log.WithField("targetService", targetService).Info("found service to mess with")

		defer func() {
			err = dart.Remove(cfg, ns, targetService)
			if err != nil {
				log.WithError(err).Fatal("cannot remove toxiproxy")
			}
		}()
		tpc, err := dart.Inject(cfg, ns, targetService)
		if err != nil {
			log.WithError(err).Fatal("cannot inject toxiproxy")
		}
		defer tpc.Close()

		proxies, err := tpc.Proxies()
		if err != nil {
			log.WithError(err).Fatal("cannot list proxies")
		}
		for pn, px := range proxies {
			err = addRandomToxic(pn, px)
			if err != nil {
				log.WithError(err).WithField("proxy", pn).Fatal("cannot add random toxic")
			}
		}

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("🎯  blowtorch up and running. Stop with SIGINT or CTRL+C")
		<-sigChan
		log.Info("received SIGINT - shutting down")
	},
}

var (
	toxicTypes   = []string{"latency", "bandwidth", "slow_close", "timeout", "slicer"}
	toxicStreams = []string{"upstream", "downstream"}
)

func addRandomToxic(name string, proxy *toxiproxy.Proxy) error {
	var (
		tname                        = randomdata.SillyName()
		ttype                        = toxicTypes[rand.Intn(len(toxicTypes))]
		tstream                      = toxicStreams[rand.Intn(len(toxicStreams))]
		tattr   toxiproxy.Attributes = make(toxiproxy.Attributes)
	)
	switch ttype {
	case "latency":
		tattr["latency"] = rand.Intn(30000) // ms
		tattr["jitter"] = rand.Intn(5000)   // ms
	case "bandwidth":
		tattr["rate"] = rand.Intn(1024) // kb/s
	case "slow_close":
		tattr["delay"] = rand.Intn(5000) // ms
	case "timeout":
		tattr["timeout"] = rand.Intn(5000) // ms
	case "slicer":
		tattr["average_size"] = rand.Intn(256) + 1 //bytes
		tattr["size_variation"] = rand.Intn(64)    // bytes
		tattr["delay"] = rand.Intn(5000)           // ms
	}
	_, err := proxy.AddToxic(tname, ttype, tstream, 1.0, tattr)
	if err != nil {
		return err
	}
	log.WithFields(log.Fields{
		"proxy":  name,
		"name":   tname,
		"type":   ttype,
		"attrs":  tattr,
		"stream": tstream,
	}).Info("adding toxic")

	return nil
}

func init() {
	rootCmd.AddCommand(ablazeCmd)
}
