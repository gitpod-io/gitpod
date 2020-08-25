// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package httpendpoint

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gitpod-io/gitpod/cerc/pkg/cerc"
	"github.com/jeremywohl/flatten"
	log "github.com/sirupsen/logrus"
)

const failStatusCode = http.StatusNotAcceptable

// Reporter holds cerc reports in memory and serves them via HTTP
type Reporter struct {
	reports map[string]cerc.Report
}

// NewReporter constructs a new Reporter
func NewReporter() *Reporter {
	r := Reporter{}
	r.reports = make(map[string]cerc.Report)
	return &r
}

// ProbeStarted is called when a new probe was started
func (reporter *Reporter) ProbeStarted(pathway string) {}

// ProbeFinished is called when the probe has finished
func (reporter *Reporter) ProbeFinished(report cerc.Report) {
	reporter.reports[report.Pathway] = report
}

// Serve provides reports via HTTP
func (reporter *Reporter) Serve(w http.ResponseWriter, r *http.Request) {

	var (
		result     interface{}
		statusCode int = http.StatusOK
	)

	format := r.FormValue("format")
	switch format {
	case "raw":
		for _, r := range reporter.reports {
			if r.Result != cerc.ProbeSuccess {
				statusCode = failStatusCode
			}
		}
		result = reporter.reports
	case "json_flat":
		result, statusCode = reporter.summary(true)
	default:
		result, statusCode = reporter.summary(false)
	}

	msg, err := json.Marshal(result)

	if err != nil {
		log.WithError(err).Fatal("error marshalling JSON response")
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintln(w, "unexpected error", err)
	} else {
		if statusCode != http.StatusOK {
			log.WithField("response", string(msg)).Warn("responding with UNHEALTHY status")
		} else {
			log.WithField("response", string(msg)).Info("responding with HEALTHY status")
		}
		w.WriteHeader(statusCode)
		fmt.Fprintln(w, string(msg))
	}
}

func (reporter *Reporter) summary(flat bool) (map[string]interface{}, int) {
	result := make(map[string]interface{})
	result["status"] = "healthy"
	for _, r := range reporter.reports {
		if r.Result != cerc.ProbeSuccess {
			result["status"] = "unhealthy"
		}
		var message interface{}
		err := json.Unmarshal([]byte(r.Message), &message)
		if err != nil {
			message = r.Message
		}
		result[r.Pathway] = map[string]interface{}{
			"result":    r.Result,
			"message":   message,
			"timestamp": r.Timestamp,
		}
	}
	var statusCode = http.StatusOK
	if result["status"] != "healthy" {
		statusCode = failStatusCode
	}
	if flat {
		result, _ = flatten.Flatten(result, "", flatten.DotStyle)
		return result, statusCode
	}
	return result, statusCode
}
