// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"google.golang.org/grpc"
	"net/http"
	"net/url"
	"os"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	supervisor_helper "github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor-helper"
	ide_metrics "github.com/gitpod-io/gitpod/ide-metrics-api"
	"github.com/go-errors/errors"
	log "github.com/sirupsen/logrus"
)

func LogError(ctx context.Context, errToReport error, errorMessage string) {
	log.WithError(errToReport).Error(errorMessage)

	file, err := os.OpenFile(os.TempDir()+"/gitpod-cli-errors.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err == nil {
		log.SetOutput(file)
	} else {
		log.SetLevel(log.FatalLevel)
	}

	conn, err := supervisor_helper.Dial(ctx)
	if err != nil {
		log.WithError(err).Error(err)
	}
	defer func(conn *grpc.ClientConn) {
		err := conn.Close()
		if err != nil {
			log.WithError(err).Error(err)
		}
	}(conn)

	wsInfo, err := supervisor_helper.FetchInfo(ctx, conn)
	if err != nil {
		log.WithError(err).Error("failed to retrieve workspace info")
		return
	}

	parsedUrl, err := url.Parse(wsInfo.GitpodHost)
	if err != nil {
		log.WithError(err).Error("cannot parse GitpodHost")
		return
	}

	ideMetricsUrl := fmt.Sprintf("https://ide.%s/metrics-api/reportError", parsedUrl.Host)

	reportErrorRequest := &ide_metrics.ReportErrorRequest{
		ErrorStack:  errors.New(errToReport).ErrorStack(),
		Component:   "gitpod-cli",
		Version:     gitpod.Version,
		UserId:      "", // todo: retrieve this from server
		WorkspaceId: wsInfo.WorkspaceId,
		InstanceId:  wsInfo.InstanceId,
		Properties:  map[string]string{},
	}

	payload, err := json.Marshal(reportErrorRequest)
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
}
