// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
	"github.com/spf13/cobra"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// debugLogCmd represents the debugLogCmd command
var debugLogCmd = &cobra.Command{
	Use:     "log <component>",
	Short:   "Enables the debug log level for a component",
	Args:    cobra.ExactArgs(1),
	Aliases: []string{"logs"},
	Run: func(cmd *cobra.Command, args []string) {
		comp := args[0]
		if comp == "supervisor" {
			log.Fatal("cannot enable supervisor debug logging yet - please edit the default workspace template and add an env var SUPERVISOR_DEBUG=true")
		}

		err := func() error {
			cfg, namespace, err := getKubeconfig()
			if err != nil {
				return err
			}
			clientSet, err := kubernetes.NewForConfig(cfg)
			if err != nil {
				return err
			}

			pods, err := util.FindPodsForComponent(clientSet, namespace, comp)
			if err != nil {
				return err
			}

			var failed bool
			for _, podName := range pods {
				err := enableLogDebug(podName, cfg, namespace)
				if err != nil {
					log.WithError(err).Error("cannot enable debug logging")
					failed = true
					continue
				}

				fmt.Println(podName)
			}

			if failed {
				os.Exit(1)
			}

			return nil
		}()

		if err != nil {
			log.Fatal(err)
		}
	},
}

func enableLogDebug(podName string, cfg *rest.Config, namespace string) error {
	freePort, err := GetFreePort()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	port := fmt.Sprintf("%d:6060", freePort)
	readychan, errchan := util.ForwardPort(ctx, cfg, namespace, podName, port)
	select {
	case <-readychan:
	case err := <-errchan:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}

	_, err = http.Post(fmt.Sprintf("http://localhost:%d/debug/logging", freePort), "application/json", bytes.NewReader([]byte(`{"level":"debug"}`)))
	return err
}

func init() {
	debugCmd.AddCommand(debugLogCmd)
}
