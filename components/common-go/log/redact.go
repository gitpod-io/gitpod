// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package log

import (
	"encoding/json"
	"fmt"
	"strings"
)

var (
	redactedValue  = "[redacted]"
	redactedFields = []string{
		"auth_",
		"password",
		"token",
	}
)

// RedactJSON removes sensitive data from JSON structures
func RedactJSON(data []byte) (res []byte, err error) {
	var jsonBlob interface{}
	err = json.Unmarshal(data, &jsonBlob)
	if err != nil {
		return data, err
	}
	redactValue(&jsonBlob)

	return json.Marshal(jsonBlob)
}

// blatently copied from https://github.com/cloudfoundry/lager/blob/master/json_redacter.go#L45
func redactValue(data *interface{}) interface{} {
	if data == nil {
		return data
	}

	if a, ok := (*data).([]interface{}); ok {
		redactArray(&a)
	} else if m, ok := (*data).(map[string]interface{}); ok {
		redactObject(&m)
	} else if s, ok := (*data).(string); ok {
		for _, prohibited := range redactedFields {
			if strings.Contains(strings.ToLower(fmt.Sprintf("%v", s)), prohibited) {
				(*data) = redactedValue
				continue
			}
		}
	}
	return (*data)
}

func redactArray(data *[]interface{}) {
	for i := range *data {
		redactValue(&((*data)[i]))
	}
}

func redactObject(data *map[string]interface{}) {
	for k, v := range *data {
		for _, prohibited := range redactedFields {
			if strings.Contains(strings.ToLower(fmt.Sprintf("%v", k)), prohibited) {
				(*data)[k] = redactedValue
				continue
			}
		}

		if (*data)[k] != redactedValue {
			//TODO: refactor
			//nolint:gosec
			(*data)[k] = redactValue(&v)
		}
	}
}
