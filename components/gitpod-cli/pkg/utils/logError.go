// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	supervisor_helper "github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor-helper"
	ide_metrics "github.com/gitpod-io/gitpod/ide-metrics-api"
	"github.com/go-errors/errors"
	log "github.com/sirupsen/logrus"
)

func LogError(ctx context.Context, errToReport error, errorMessage string) {
	log.WithError(errToReport).Error(errorMessage)

	conn, err := supervisor_helper.Dial(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	wsInfo, err := supervisor_helper.FetchInfo(ctx, conn)
	if err != nil {
		log.WithError(err).Fatal("failed to retrieve workspace info")
		return
	}

	parsedUrl, err := url.Parse(wsInfo.GitpodHost)
	if err != nil {
		log.WithError(err).Fatal("cannot parse GitpodHost")
		return
	}

	ideMetricsUrl := fmt.Sprintf("https://ide.%s/metrics-api/reportError", parsedUrl.Host)

	reportErrorRequest := &ide_metrics.ReportErrorRequest{
		ErrorStack:  errToReport.(*errors.Error).ErrorStack(),
		Component:   "gitpod-cli",
		Version:     gitpod.Version,
		UserId:      "", // todo: retrieve this from server
		WorkspaceId: wsInfo.WorkspaceId,
		InstanceId:  wsInfo.InstanceId,
		Properties:  map[string]string{},
	}

	payload, err := json.Marshal(reportErrorRequest)
	if err != nil {
		log.WithError(err).Fatal("failed to marshal json while attempting to report error")
		return
	}

	req, err := http.NewRequest("POST", ideMetricsUrl, bytes.NewBuffer(payload))
	if err != nil {
		log.WithError(err).Fatal("failed to init request for ide-metrics-api")
		return
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.WithError(err).Fatal("cannot report error to ide-metrics-api")
		return
	}

	// todo: remove before merging
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Println("Error reported succerssfully")
	fmt.Println(string(body))
	fmt.Println(resp.StatusCode)
}
