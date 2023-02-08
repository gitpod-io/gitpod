// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/api"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	ide_metrics "github.com/gitpod-io/gitpod/ide-metrics-api"
)

var errorReportCmdOpts struct {
	data string
}

// errorReportCmd represents the errorReportCmd command
var errorReportCmd = &cobra.Command{
	Use:    "error-report",
	Long:   "Sending error report to ide-metrics",
	Hidden: true,
	Args:   cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		file, err := os.OpenFile(os.TempDir()+"/supervisor-errors.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err == nil {
			log.SetOutput(file)
			defer file.Close()
		} else {
			log.SetLevel(log.FatalLevel)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var data ide_metrics.ReportErrorRequest
		err = json.Unmarshal([]byte(errorReportCmdOpts.data), &data)
		if err != nil {
			log.Fatal(err)
		}

		conn := dialSupervisor()
		defer conn.Close()
		wsInfo, err := api.NewInfoServiceClient(conn).WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
		if err != nil {
			log.Fatal(err)
		}

		data.WorkspaceId = wsInfo.WorkspaceId
		data.InstanceId = wsInfo.InstanceId
		data.UserId = wsInfo.OwnerId

		parsedUrl, err := url.Parse(wsInfo.GitpodHost)
		if err != nil {
			log.Fatal("cannot parse GitpodHost")
			return
		}

		ideMetricsUrl := fmt.Sprintf("https://ide.%s/metrics-api/reportError", parsedUrl.Host)

		payload, err := json.Marshal(data)
		if err != nil {
			log.WithError(err).Error("failed to marshal json while attempting to report error")
			return
		}

		req, err := http.NewRequest("POST", ideMetricsUrl, bytes.NewBuffer(payload))
		if err != nil {
			log.WithError(err).Error("failed to init request for ide-metrics-api")
			return
		}

		client := &http.Client{}
		_, err = client.Do(req)
		if err != nil {
			log.WithError(err).Error("cannot report error to ide-metrics-api")
			return
		}
	},
}

func init() {
	rootCmd.AddCommand(errorReportCmd)
	errorReportCmd.Flags().StringVarP(&errorReportCmdOpts.data, "data", "", "", "json data")

	_ = errorReportCmd.MarkFlagRequired("data")
}
