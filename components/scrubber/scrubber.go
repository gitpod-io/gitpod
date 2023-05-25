// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"

	"github.com/mitchellh/reflectwalk"
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

// Scrub scrubs the implementing type from sensitive information
type Scrub interface {
	Scrub(scrubber Scrubber) error
}

// Default is the default scrubber consumers of this package should use
var Default Scrubber = newScrubberImpl()

func newScrubberImpl() *scrubberImpl {
	fieldIndex := make(map[string]Sanitisatiser, len(HashedFieldNames)+len(RedactedFieldNames))
	for _, f := range HashedFieldNames {
		fieldIndex[strings.ToLower(f)] = SanitiseHash
	}
	for _, f := range RedactedFieldNames {
		fieldIndex[strings.ToLower(f)] = SanitiseRedact
	}
	res := &scrubberImpl{
		FieldIndex: fieldIndex,
	}
	res.Walker = &structScrubber{Parent: res}
	return res
}

type scrubberImpl struct {
	Walker     *structScrubber
	FieldIndex map[string]Sanitisatiser
}

// JSON implements Scrubber
func (s *scrubberImpl) JSON(msg json.RawMessage) (json.RawMessage, error) {
	var content map[string]interface{}
	err := json.Unmarshal(msg, &content)
	if err != nil {
		return nil, fmt.Errorf("cannot scrub JSON: %w", err)
	}
	err = s.Struct(content)
	if err != nil {
		return nil, fmt.Errorf("cannot scrub JSON: %w", err)
	}
	res, err := json.Marshal(content)
	if err != nil {
		return nil, fmt.Errorf("cannot scrub JSON: %w", err)
	}
	return res, nil
}

// KeyValue implements Scrubber
func (s *scrubberImpl) KeyValue(key string, value string) (sanitisedValue string) {
	f, ok := s.FieldIndex[strings.ToLower(key)]
	if !ok {
		return value
	}
	return f(value)
}

// Struct implements Scrubber
func (s *scrubberImpl) Struct(val any) error {
	return reflectwalk.Walk(val, s.Walker)
}

// Value implements Scrubber
func (scrubberImpl) Value(value string) string {
	for key, expr := range HashedValues {
		value = expr.ReplaceAllStringFunc(value, func(s string) string {
			return SanitiseHash(s, SanitiseWithKeyName(key))
		})
	}
	for key, expr := range RedactedValues {
		value = expr.ReplaceAllStringFunc(value, func(s string) string {
			return SanitiseRedact(s, SanitiseWithKeyName(key))
		})
	}

	return value
}

type structScrubber struct {
	Parent Scrubber
}

// Primitive implements reflectwalk.PrimitiveWalker
func (s *structScrubber) Primitive(val reflect.Value) error {
	if val.Kind() == reflect.String && val.CanSet() {
		val.SetString(s.Parent.Value(val.String()))
	}

	// We don't call reflectwalk here because we're at the a leaf of the object tree.

	return nil
}

var (
	_ reflectwalk.MapWalker       = &structScrubber{}
	_ reflectwalk.StructWalker    = &structScrubber{}
	_ reflectwalk.PrimitiveWalker = &structScrubber{}
)

// Struct implements reflectwalk.StructWalker
func (*structScrubber) Struct(reflect.Value) error {
	return nil
}

// StructField implements reflectwalk.StructWalker
func (s *structScrubber) StructField(field reflect.StructField, val reflect.Value) error {
	if val.Kind() == reflect.String {
		var (
			setExplicitValue bool
			explicitValue    string
		)
		tag := field.Tag.Get("scrub")
		switch tag {
		case "ignore":
			return nil
		case "hash":
			setExplicitValue = true
			explicitValue = SanitiseHash(val.String())
		case "redact":
			setExplicitValue = true
			explicitValue = SanitiseRedact(val.String())
		}

		if !val.CanSet() {
			return fmt.Errorf("cannot set %s", field.PkgPath)
		}
		if setExplicitValue {
			val.SetString(explicitValue)
			return nil
		}
		val.SetString(s.Parent.KeyValue(field.Name, val.String()))
		return nil
	}

	return reflectwalk.Walk(val.Interface(), s)
}

// Map implements reflectwalk.MapWalker
func (s *structScrubber) Map(m reflect.Value) error {
	return nil
}

// MapElem implements reflectwalk.MapWalker
func (s *structScrubber) MapElem(m reflect.Value, k reflect.Value, v reflect.Value) error {
	kind := v.Kind()
	if kind == reflect.Interface {
		v = v.Elem()
		kind = v.Kind()
	}
	if kind == reflect.String {
		m.SetMapIndex(k, reflect.ValueOf(s.Parent.KeyValue(k.String(), v.String())))
		return nil
	}

	return reflectwalk.Walk(v.Interface(), s)
}
