// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/scheduler/pkg/extender"
)

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the node labeler",
	Run: func(cmd *cobra.Command, args []string) {
		router := mux.NewRouter()
		router.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
			fmt.Fprint(w, "OK")
		})

		extender.AddPredicate(router, WorkspacePredicate)

		log.Println("info: server starting on the port :8080")
		if err := http.ListenAndServe(":8080", router); err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)

	rootCmd.PersistentFlags().StringVar(&namespace, "namespace", "default", "Namespace where Gitpod components are running")
}
