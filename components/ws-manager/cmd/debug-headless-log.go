// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var debugHeadlessLogNS string

// debugHeadlessLogCmd represents the debugHeadlessLog command
var debugHeadlessLogCmd = &cobra.Command{
	Use:   "headless-log <pod>",
	Short: "Starts a headless log listener on any pod and prints to stdout",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		clientset, err := newClientSet()
		if err != nil {
			log.WithError(err).Fatal("cannot connect to Kubernetes")
		}
		log.Info("connected to Kubernetes")

		pod, err := clientset.CoreV1().Pods(debugHeadlessLogNS).Get(context.Background(), args[0], metav1.GetOptions{})
		if err != nil {
			log.WithError(err).Fatal("cannot start listener")
			return
		}
		if pod == nil {
			log.Fatal("pod is nil - this should not happen without an error")
			return
		}
		log.WithField("status", pod.Status).Info("debugging")

		// TODO: stream logs from loki

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("Log listener is running. Stop with SIGINT or CTRL+C")
		<-sigChan
		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	debugCmd.AddCommand(debugHeadlessLogCmd)

	debugHeadlessLogCmd.PersistentFlags().StringVar(&debugHeadlessLogNS, "namespace", "", "Kubernetes namespace to work with")
}
