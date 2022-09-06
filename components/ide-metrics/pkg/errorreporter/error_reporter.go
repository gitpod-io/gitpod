// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package errorreporter

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"cloud.google.com/go/logging"
	"github.com/gitpod-io/gitpod/common-go/log"
)

type ErrorReporter interface {
	Report(ReportedErrorEvent)
}

// NewFromEnvironment creates a new error report instance based on the GOOGLE_PROJECT and
// GOOGLE_APPLICATION_CREDENTIALS environment variable. This function never returns nil
func NewFromEnvironment() ErrorReporter {
	isEnabled := os.Getenv("GITPOD_ENABLED_ERROR_REPORTING") == "true"
	gcpProject := os.Getenv("GOOGLE_PROJECT")
	credsFile := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")

	if !isEnabled {
		return &noErrorReporter{}
	}
	if gcpProject != "" && credsFile != "" {
		c, err := logging.NewClient(context.Background(), gcpProject)
		if err != nil {
			log.Fatal(err)
		}
		logger := c.Logger("reported_errors")
		return &gcpErrorReporter{
			logger: *logger,
		}
	}
	return &logErrorReporter{}
}

type ReportedErrorEvent struct {
	Type           string                      `json:"@type,omitempty"`
	Message        string                      `json:"message"`
	UserId         string                      `json:"userId"`
	WorkspaceID    string                      `json:"workspaceId"`
	InstanceId     string                      `json:"instanceId"`
	Properties     map[string]string           `json:"properties"`
	ServiceContext ReportedErrorServiceContext `json:"serviceContext"`
}
type ReportedErrorServiceContext struct {
	Service string `json:"service"`
	Version string `json:"version,omitempty"`
}

type gcpErrorReporter struct {
	logger logging.Logger
}

func (r *gcpErrorReporter) Report(event ReportedErrorEvent) {
	r.logger.Log(logging.Entry{
		Severity: logging.Error,
		Payload:  event,
	})
}

type logErrorReporter struct {
}

func (r *logErrorReporter) Report(event ReportedErrorEvent) {
	b, err := json.Marshal(event)
	if err != nil {
		log.WithError(err).Error("cannot marshal error")
		return
	}

	fmt.Println(string(b))
}

type noErrorReporter struct{}

func (r *noErrorReporter) Report(event ReportedErrorEvent) {}
