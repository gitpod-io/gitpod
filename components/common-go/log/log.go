// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package log

import (
	"fmt"
	"os"

	"github.com/sirupsen/logrus"
	log "github.com/sirupsen/logrus"
)

const (
	// OwnerField is the log field name of a workspace owner
	OwnerField = "userId"
	// WorkspaceField is the log field name of a workspace ID (not instance ID)
	WorkspaceField = "workspaceId"
	// InstanceField is the log field name of a workspace instance ID
	InstanceField = "instanceId"
)

// OWI builds a structure meant for logrus which contains the owner, workspace and instance.
// Beware that this refers to the terminology outside of wsman which maps like:
//    owner = owner, workspace = metaID, instance = workspaceID
func OWI(owner, workspace, instance string) log.Fields {
	return log.Fields{
		OwnerField:     owner,
		WorkspaceField: workspace,
		InstanceField:  instance,
	}
}

// ServiceContext is the shape required for proper error logging in the GCP context.
// See https://cloud.google.com/error-reporting/reference/rest/v1beta1/ServiceContext
// Note that we musn't set resourceType for reporting errors.
type ServiceContext struct {
	Service string `json:"service"`
	Version string `json:"version"`
}

// Log is the application wide console logger
var Log = log.WithFields(log.Fields{})

// Init initializes/configures the application-wide logger
func Init(service, version string, json, verbose bool) {
	Log = log.WithFields(log.Fields{
		"serviceContext": ServiceContext{service, version},
	})

	if json {
		log.SetFormatter(&gcpFormatter{
			log.JSONFormatter{
				FieldMap: log.FieldMap{
					log.FieldKeyLevel: "severity",
					log.FieldKeyMsg:   "message",
				},
			},
		})
		Log.Info("enabled JSON logging")
	}
	if verbose {
		log.SetLevel(log.DebugLevel)
		Log.Info("enabled verbose logging")
	}
}

// gcpFormatter formats errors according to GCP rules, see
type gcpFormatter struct {
	log.JSONFormatter
}

func (f *gcpFormatter) Format(entry *log.Entry) ([]byte, error) {
	hasError := false
	for k, v := range entry.Data {
		switch v := v.(type) {
		case error:
			// Otherwise errors are ignored by `encoding/json`
			// https://github.com/sirupsen/logrus/issues/137
			//
			// Print errors verbosely to get stack traces where available
			entry.Data[k] = fmt.Sprintf("%+v", v)
			hasError = true
		}
	}
	if entry.Level <= log.WarnLevel && hasError {
		entry.Data["@type"] = "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent"
	}

	return f.JSONFormatter.Format(entry)
}

// KubernetesTerminationLogHook writes to the kubernetes termination log if the application exits with Fatal
type KubernetesTerminationLogHook struct {
	TerminationLogPath string
}

// Levels returns the levels this hook should fire at
func (h *KubernetesTerminationLogHook) Levels() []logrus.Level {
	return []logrus.Level{
		log.FatalLevel,
	}
}

// Fire executes the hook
func (h *KubernetesTerminationLogHook) Fire(e *logrus.Entry) error {
	f, err := os.OpenFile(h.TerminationLogPath, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("cannot open termination log: %w", err)
	}
	defer f.Close()

	l, err := e.String()
	if err != nil {
		return fmt.Errorf("cannot serialize log entry: %w", err)
	}
	_, err = f.WriteString(l + "\n")
	if err != nil {
		return fmt.Errorf("cannot write to termination log: %w", err)
	}

	return nil
}
