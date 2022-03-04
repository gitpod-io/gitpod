// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package util

import (
	"encoding/json"
	"errors"
	"time"
)

// Duration is an alias for time.Duration to facilitate JSON unmarshaling
// see https://stackoverflow.com/questions/48050945/how-to-unmarshal-json-into-durations
type Duration time.Duration

// UnmarshalJSON parses the duration to a time.Duration
func (d *Duration) UnmarshalJSON(b []byte) error {
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch value := v.(type) {
	case float64:
		*d = Duration(time.Duration(value))
		return nil
	case string:
		tmp, err := time.ParseDuration(value)
		if err != nil {
			return err
		}
		*d = Duration(tmp)
		return nil
	default:
		return errors.New("invalid duration")
	}
}

// MarshalJSON turns a duration into a string
func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).String())
}

// String produces a string representation of this duration
func (d Duration) String() string {
	return time.Duration(d).String()
}
