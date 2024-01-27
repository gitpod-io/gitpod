// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package errorreporter

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/components/scrubber"
)

type ErrorReporter interface {
	Report(ReportedErrorEvent)
}

// NewFromEnvironment creates a new error report instance based on the GITPOD_ENABLED_ERROR_REPORTING
// environment variable. This function never returns nil
func NewFromEnvironment() ErrorReporter {
	isEnabled := os.Getenv("GITPOD_ENABLED_ERROR_REPORTING") == "true"
	if !isEnabled {
		return &noErrorReporter{}
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
	Severity       string                      `json:"severity"`
}
type ReportedErrorServiceContext struct {
	Service string `json:"service"`
	Version string `json:"version,omitempty"`
}

type logErrorReporter struct {
}

func (r *logErrorReporter) Report(event ReportedErrorEvent) {
	err := scrubber.Default.Struct(&event)
	if err != nil {
		log.WithError(err).Error("cannot scrub error")
		return
	}
	b, err := json.Marshal(event)
	if err != nil {
		log.WithError(err).Error("cannot marshal error")
		return
	}

	fmt.Println(string(b))
}

type noErrorReporter struct{}

func (r *noErrorReporter) Report(event ReportedErrorEvent) {}
