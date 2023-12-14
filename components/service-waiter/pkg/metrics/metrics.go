// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package metrics

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// service_waiter_skip_components
const WaitComponentFeatureFlagMetricName = "service_waiter_skip_components_result_total"

func AddSkipComponentsCounter(host, value string, isActual bool) {
	labels := map[string]string{
		"value": value,
		"ok":    strconv.FormatBool(isActual),
	}
	addCounter(host, WaitComponentFeatureFlagMetricName, labels)
}

func addCounter(host, metricName string, labels map[string]string) {
	if host == "" {
		log.Error("host is empty")
		return
	}
	body := map[string]interface{}{
		"labels": labels,
		"value":  1,
	}
	b, err := json.Marshal(body)
	if err != nil {
		log.WithError(err).Error("cannot marshal body")
		return
	}
	resp, err := http.Post(host+"/metrics-api/metrics/counter/add/"+metricName, "application/json", bytes.NewReader(b))
	if err != nil {
		log.WithError(err).Error("cannot post metrics")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.WithField("status", resp.Status).Error("failed to post metrics")
	}
	log.Info("metric reported")
}
