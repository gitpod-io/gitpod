// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package log

import (
	"bytes"
	"encoding/json"
	"fmt"
	"runtime"
	"time"

	"github.com/itchyny/gojq"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

type fieldKey string

// FieldMap allows customization of the key names for default fields.
type FieldMap map[fieldKey]string

func (f FieldMap) resolve(key fieldKey) string {
	if k, ok := f[key]; ok {
		return k
	}

	return string(key)
}

// JSONFormatter formats logs into parsable json
type JSONFormatter struct {
	// FieldMap allows users to customize the names of keys for default fields.
	// As an example:
	// formatter := &JSONFormatter{
	//   	FieldMap: FieldMap{
	// 		 FieldKeyTime:  "@timestamp",
	// 		 FieldKeyLevel: "@level",
	// 		 FieldKeyMsg:   "@message",
	// 		 FieldKeyFunc:  "@caller",
	//    },
	// }
	FieldMap FieldMap

	// CallerPrettyfier can be set by the user to modify the content
	// of the function and file keys in the json data when ReportCaller is
	// activated. If any of the returned value is the empty string the
	// corresponding key will be removed from json fields.
	CallerPrettyfier func(*runtime.Frame) (function string, file string)

	Filters []string

	compiledFilters []*gojq.Code
}

const (
	defaultTimestampFormat = time.RFC3339
)

var (
	WSManagerFilters = []string{
		`walk(if type == "object"
		then
			(if has("envvars") then .envvars = [] else . end) |
			(if has("ssh_public_keys") then .ssh_public_keys = [] else . end) |
			(if has("env") then .env = [] else . end) |
			(if has("auth_password") then .auth_password = "[REDACTED]" else . end) |
			(if has("email") then .email = "[REDACTED]" else . end) |
			(if has("owner_token") then .owner_token = "[REDACTED]" else . end)
		else
		.
		end )
		`,
	}
)

// SetFilters configures a list of filters to apply to log messages before returning it.
func (f *JSONFormatter) SetFilters(filters []string) error {
	f.Filters = filters
	f.compiledFilters = make([]*gojq.Code, 0)

	for _, filter := range filters {
		query, err := gojq.Parse(filter)
		if err != nil {
			return xerrors.Errorf("cannot parse jq filter: %v", err)
		}

		code, err := gojq.Compile(query)
		if err != nil {
			return xerrors.Errorf("cannot compile jq filter: %v", err)
		}

		f.compiledFilters = append(f.compiledFilters, code)
	}

	return nil
}

// Format renders a single log entry
func (f *JSONFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	data := make(logrus.Fields, len(entry.Data)+4)
	for k, v := range entry.Data {
		switch v := v.(type) {
		case error:
			// Otherwise errors are ignored by `encoding/json`
			// https://github.com/sirupsen/logrus/issues/137
			data[k] = v.Error()
		default:
			data[k] = v
		}
	}

	prefixFieldClashes(data, f.FieldMap, entry.HasCaller())

	/*
		if entry.err != "" {
			data[f.FieldMap.resolve(logrus.FieldKeyLogrusError)] = entry.err
		}
	*/

	data[f.FieldMap.resolve(logrus.FieldKeyTime)] = entry.Time.Format(defaultTimestampFormat)

	data[f.FieldMap.resolve(logrus.FieldKeyMsg)] = entry.Message
	data[f.FieldMap.resolve(logrus.FieldKeyLevel)] = entry.Level.String()
	if entry.HasCaller() {
		funcVal := entry.Caller.Function
		fileVal := fmt.Sprintf("%s:%d", entry.Caller.File, entry.Caller.Line)
		if f.CallerPrettyfier != nil {
			funcVal, fileVal = f.CallerPrettyfier(entry.Caller)
		}

		if funcVal != "" {
			data[f.FieldMap.resolve(logrus.FieldKeyFunc)] = funcVal
		}
		if fileVal != "" {
			data[f.FieldMap.resolve(logrus.FieldKeyFile)] = fileVal
		}
	}

	var b *bytes.Buffer
	if entry.Buffer != nil {
		b = entry.Buffer
	} else {
		b = &bytes.Buffer{}
	}

	encoder := json.NewEncoder(b)
	encoder.SetEscapeHTML(true)

	if err := encoder.Encode(data); err != nil {
		return nil, fmt.Errorf("failed to marshal fields to JSON, %w", err)
	}

	if f.compiledFilters == nil {
		return b.Bytes(), nil
	}

	filtered, err := jqExec(
		b.Bytes(),
		f.compiledFilters,
	)
	if err != nil {
		return nil, xerrors.Errorf("cannot filter message: %v", err)
	}

	return filtered, nil
}

// This is to not silently overwrite `time`, `msg`, `func` and `level` fields when
// dumping it. If this code wasn't there doing:
//
//	logrus.WithField("level", 1).Info("hello")
//
// Would just silently drop the user provided level. Instead with this code
// it'll logged as:
//
//	{"level": "info", "fields.level": 1, "msg": "hello", "time": "..."}
//
// It's not exported because it's still using Data in an opinionated way. It's to
// avoid code duplication between the two default formatters.
func prefixFieldClashes(data logrus.Fields, fieldMap FieldMap, reportCaller bool) {
	timeKey := fieldMap.resolve(logrus.FieldKeyTime)
	if t, ok := data[timeKey]; ok {
		data["fields."+timeKey] = t
		delete(data, timeKey)
	}

	msgKey := fieldMap.resolve(logrus.FieldKeyMsg)
	if m, ok := data[msgKey]; ok {
		data["fields."+msgKey] = m
		delete(data, msgKey)
	}

	levelKey := fieldMap.resolve(logrus.FieldKeyLevel)
	if l, ok := data[levelKey]; ok {
		data["fields."+levelKey] = l
		delete(data, levelKey)
	}

	logrusErrKey := fieldMap.resolve(logrus.FieldKeyLogrusError)
	if l, ok := data[logrusErrKey]; ok {
		data["fields."+logrusErrKey] = l
		delete(data, logrusErrKey)
	}

	// If reportCaller is not set, 'func' will not conflict.
	if reportCaller {
		funcKey := fieldMap.resolve(logrus.FieldKeyFunc)
		if l, ok := data[funcKey]; ok {
			data["fields."+funcKey] = l
		}
		fileKey := fieldMap.resolve(logrus.FieldKeyFile)
		if l, ok := data[fileKey]; ok {
			data["fields."+fileKey] = l
		}
	}
}

func jqExec(input []byte, filters []*gojq.Code) ([]byte, error) {
	var parsedInput interface{}
	if err := json.Unmarshal(input, &parsedInput); err != nil {
		return nil, xerrors.Errorf("cannot unmarshall JSON: %v", err)
	}

	for _, filter := range filters {
		parsedInput = processFilter(parsedInput, filter)
	}

	out := &bytes.Buffer{}
	enc := json.NewEncoder(out)
	if err := enc.Encode(parsedInput); err != nil {
		return nil, xerrors.Errorf("cannot encode JSON")
	}

	return out.Bytes(), nil
}

func processFilter(input interface{}, filter *gojq.Code) interface{} {
	var ret interface{}

	iter := filter.Run(input)
	for {
		got, hasNext := iter.Next()
		if !hasNext {
			break
		}
		/*
			if err, ok := got.(error); ok {
				return nil, err
			}
		*/
		ret = got
	}

	return ret
}
