// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/blowtorch/pkg/dart"
)

// injectCmd represents the inject command
var injectCmd = &cobra.Command{
	Use:   "inject <service-name>",
	Short: "Adds a toxiproxy intermediate for a particular service",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		cfg, ns, err := getKubeconfig()
		if err != nil {
			log.WithError(err).Fatal("cannot get Kubernetes client config")
		}

		var opts []dart.InjectOption
		arflag, err := cmd.Flags().GetStringToString("additional-routes")
		if err != nil {
			log.WithError(err).Fatal("bug in blowtorch")
		}
		for tps, apss := range arflag {
			tp, err := strconv.ParseUint(tps, 10, 16)
			if err != nil {
				log.WithField("targetPort", tps).WithError(err).Fatal("additional route: target port is not a number")
			}
			for _, s := range strings.Split(apss, ",") {
				s = strings.TrimSpace(s)
				ap, err := strconv.ParseUint(s, 10, 16)
				if err != nil {
					log.WithField("targetPort", tps).WithField("additionalPort", ap).WithError(err).Fatal("additional route: additional port is not a number")
				}
				opts = append(opts, dart.WithAdditionalRoute(int(tp), int(ap)))
				log.WithField("targetPort", tp).WithField("additionalPort", ap).Info("adding additional route")
			}
		}

		defer func() {
			err = dart.Remove(cfg, ns, args[0])
			if err != nil {
				log.WithError(err).Fatal("cannot remove toxiproxy")
			}
		}()
		_, err = dart.Inject(cfg, ns, args[0], opts...)
		if err != nil {
			log.WithError(err).Fatal("cannot inject toxiproxy")
		}

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("🎯  blowtorch up and running. Stop with SIGINT or CTRL+C")
		log.Warn("")
		log.Warn("Note: Don't forget to restart any pod that uses the service you've just replaced.")
		log.Warn("      Otherwise you might still be using the original service and toxiproxy will")
		log.Warn("      have no effect.")
		<-sigChan
		log.Info("received SIGINT - shutting down")

	},
}

func init() {
	rootCmd.AddCommand(injectCmd)

	injectCmd.Flags().StringToStringP("additional-routes", "a", make(map[string]string), "add an additional route for a target port, e.g. 8080=9080,9090 where 8080 is the original target port")
}
