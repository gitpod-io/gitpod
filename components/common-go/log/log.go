// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package log

import (
	"encoding/json"
	"fmt"
	"io"
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

// setup default log level for components without initial invocation of log.Init.
func init() {
	logLevelFromEnv()
}

func logLevelFromEnv() {
	level := os.Getenv("LOG_LEVEL")
	if level == "" {
		return
	}

	newLevel, err := logrus.ParseLevel(level)
	if err == nil {
		Log.Logger.SetLevel(newLevel)
	}
}

// Init initializes/configures the application-wide logger
func Init(service, version string, json, verbose bool) {
	Log = log.WithFields(log.Fields{
		"serviceContext": ServiceContext{service, version},
	})

	if json {
		Log.Logger.SetFormatter(&gcpFormatter{
			log.JSONFormatter{
				FieldMap: log.FieldMap{
					log.FieldKeyMsg: "message",
				},
			},
		})
	} else {
		Log.Logger.SetFormatter(&logrus.TextFormatter{})
	}

	// update default log level
	logLevelFromEnv()

	if verbose {
		Log.Logger.SetLevel(log.DebugLevel)
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
	// map to gcp severity. See https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
	var severity string = "INFO"
	switch entry.Level {
	case logrus.TraceLevel:
		severity = "DEBUG"
	case logrus.DebugLevel:
		severity = "DEBUG"
	case logrus.InfoLevel:
		severity = "INFO"
	case logrus.WarnLevel:
		severity = "WARNING"
	case logrus.ErrorLevel:
		severity = "ERROR"
	case logrus.FatalLevel:
		severity = "CRITICAL"
	case logrus.PanicLevel:
		severity = "EMERGENCY"
	}
	entry.Data["severity"] = severity
	if entry.Level <= log.WarnLevel && hasError {
		entry.Data["@type"] = "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent"
	}

	return f.JSONFormatter.Format(entry)
}

// JSONWriter produces a writer that wraps everything
// that's written to it in a log message.
// Callers are expected to close the returned writer.
//
// Beware: due to logEntry not being synchronised, writes
// to the returned writer must not concurrent.
func JSONWriter(logEntry *logrus.Entry) io.WriteCloser {
	rd, rw := io.Pipe()
	go func() {
		defer func() {
			err := recover()
			if err != nil {
				logrus.Warnf("log.JSONWriter panic: %v", err)
			}
		}()

		dec := json.NewDecoder(rd)
		for {
			var entry jsonEntry
			if err := dec.Decode(&entry); err != nil {
				logrus.Errorf("log.JSONWriter decoding JSON: %v", err)
				continue
			}

			// common field name
			message := entry.Message
			if message == "" {
				// msg is defined in runc
				message = entry.Msg
			}

			if entry.Level == logrus.DebugLevel || entry.Level == logrus.ErrorLevel {
				logEntry.Log(entry.Level, message)
			}
		}
	}()

	return rw
}

type jsonEntry struct {
	Level   logrus.Level `json:"level,omitempty"`
	Message string       `json:"message,omitempty"`
	Msg     string       `json:"msg,omitempty"`
}
