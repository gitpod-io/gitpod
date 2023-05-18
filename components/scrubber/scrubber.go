// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"encoding/json"
)

type Scrubber interface {
	// Value scrubs a single value, by trying to detect the kind of data it may contain.
	// This is an entirely heuristic effort with the lowest likelihood of success. Prefer
	// the other methods over this one. No assumptions about the structure of the data are made,
	// e.g. that the value is a JSON string.
	Value(value string) string

	// KeyValue scrubs a key-value pair. The key is never changed, assuming that it's a hardcoded,
	// well choosen identifier. The value however is sanitisied much like Value() would, except with the
	// additional hint of the key name itself.
	KeyValue(key, value string) (sanitisedValue string)

	// JSON scrubs a JSON structure using a combination of KeyValue() and Value(). If the msg
	// is not valid JSON, an error is returned.
	JSON(msg json.RawMessage) (json.RawMessage, error)

	// Struct scrubes a struct. val must be a pointer, otherwise an error is returned.
	// By default only string and json.RawMessage fields are scrubbed.
	// The `scrub` struct tag can be used to influnce the scrubber. The struct tag takes the following values:
	//   - `ignore` which causes the scrubber to ignore the field
	//   - `hash` which makes the scrubber hash the field value
	//   - `redact` which makes the scrubber redact the field value
	//
	// Example:
	//   type Example struct {
	// 		Username      string `scrub:"ignore"`
	//	    Password      string
	//	    Inconspicuous string `scrub:"redact"`
	//   }
	//
	Struct(val any) error
}

// Default is the default scrubber consumers of this package should use
var Default Scrubber = scrubberImpl{}

type scrubberImpl struct{}

// JSON implements Scrubber
func (scrubberImpl) JSON(msg json.RawMessage) (json.RawMessage, error) {
	panic("unimplemented")
}

// KeyValue implements Scrubber
func (scrubberImpl) KeyValue(key string, value string) (sanitisedValue string) {
	panic("unimplemented")
}

// Struct implements Scrubber
func (scrubberImpl) Struct(val any) error {
	panic("unimplemented")
}

// Value implements Scrubber
func (scrubberImpl) Value(value string) string {
	panic("unimplemented")
}
