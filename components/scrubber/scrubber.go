// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
	"strings"

	"github.com/mitchellh/reflectwalk"
)

/*
TrustedValue defines a value that should be treated as trusted and not subjected to scrubbing.

When a TrustedValue is encountered during the scrubbing process, it is skipped over.
This allows specific values to be exempted from the scrubbing process when necessary.

Example:

	type Example struct {
		Username string
		Email    string
		Password string
	}

	type TrustedExample struct {
		Example
	}

	func (TrustedExample) isTrustedValue() {}

	func scrubExample(e *Example) *TrustedExample {
		return &TrustedExample{
			Example: Example{
				Username: e.Username,
				Email:    "trusted:" + Default.Value(e.Email),
				Password: "trusted:" + Default.KeyValue("password", e.Password),
			},
		}
	}
*/
type TrustedValue interface {
	IsTrustedValue()
}

// Scrubber defines the interface for a scrubber, which can sanitise various types of data.
// The scrubbing process involves removing or replacing sensitive data to prevent it from being exposed.
//
// The scrubbing process respects instances of TrustedValue. When a TrustedValue is encountered,
// the scrubber does not attempt to scrub it and instead skips over it. This can be used to mark
// specific values that should not be scrubbed.
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
	// It mutates the struct in-place.
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
var Default Scrubber = newScrubberImpl()

func newScrubberImpl() *scrubberImpl {
	hashedRegex, err := regexp.Compile("(?i)(" + strings.Join(HashedFieldNames, "|") + ")")
	if err != nil {
		panic(fmt.Errorf("cannot compile hashed regex: %w", err))
	}

	redactedRegex, err := regexp.Compile("(?i)(" + strings.Join(RedactedFieldNames, "|") + ")")
	if err != nil {
		panic(fmt.Errorf("cannot compile redacted regex: %w", err))
	}

	res := &scrubberImpl{
		RegexpIndex: map[*regexp.Regexp]Sanitisatiser{
			hashedRegex:   SanitiseHash,
			redactedRegex: SanitiseRedact,
		},
	}
	res.Walker = &structScrubber{Parent: res}

	return res
}

type scrubberImpl struct {
	Walker      *structScrubber
	RegexpIndex map[*regexp.Regexp]Sanitisatiser
}

// JSON implements Scrubber
func (s *scrubberImpl) JSON(msg json.RawMessage) (json.RawMessage, error) {
	var content any
	err := json.Unmarshal(msg, &content)
	if err != nil {
		return nil, fmt.Errorf("cannot scrub JSON: %w", err)
	}
	err = s.scrubJsonValue(&content)
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
	sanitisatiser := s.getSanitisatiser(key)
	if sanitisatiser == nil {
		return value
	}
	return sanitisatiser(value)
}

// getSanitisatiser implements
func (s *scrubberImpl) getSanitisatiser(key string) Sanitisatiser {
	for re, sanitisatiser := range s.RegexpIndex {
		if re.MatchString(key) {
			return sanitisatiser
		}
	}

	return nil
}

func (s *scrubberImpl) scrubJsonValue(val *any) error {
	if val == nil {
		return nil
	}
	if v, ok := (*val).(string); ok {
		*val = s.Value(v)
		return nil
	}
	return s.Struct(*val)
}

// Struct implements Scrubber
func (s *scrubberImpl) Struct(val any) error {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case map[string]interface{}:
		err := s.scrubJsonObject(v)
		if err != nil {
			return err
		}
	case []interface{}:
		err := s.scrubJsonSlice(v)
		if err != nil {
			return err
		}
	default:
		return reflectwalk.Walk(val, s.Walker)
	}
	return nil
}

func (s *scrubberImpl) scrubJsonObject(val map[string]interface{}) error {
	// fix https://github.com/gitpod-io/security/issues/64
	name, _ := val["name"].(string)
	value, _ := val["value"].(string)
	if name != "" && value != "" {
		val["value"] = s.KeyValue(name, value)
	}

	for k, v := range val {
		if str, ok := v.(string); ok {
			val[k] = s.KeyValue(k, str)
		} else {
			err := s.scrubJsonValue(&v)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *scrubberImpl) scrubJsonSlice(val []interface{}) error {
	for i := range val {
		err := s.scrubJsonValue(&(val[i]))
		if err != nil {
			return err
		}
	}
	return nil
}

// Value implements Scrubber
func (s *scrubberImpl) Value(value string) string {
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
	Parent *scrubberImpl
}

var (
	_ reflectwalk.MapWalker          = &structScrubber{}
	_ reflectwalk.StructWalker       = &structScrubber{}
	_ reflectwalk.PrimitiveWalker    = &structScrubber{}
	_ reflectwalk.PointerValueWalker = &structScrubber{}
)

// Pointer implements reflectwalk.PointerValueWalker
func (s *structScrubber) Pointer(val reflect.Value) error {
	value := val.Interface()
	if _, ok := value.(TrustedValue); ok {
		return reflectwalk.SkipEntry
	}
	return nil
}

// Primitive implements reflectwalk.PrimitiveWalker
func (s *structScrubber) Primitive(val reflect.Value) error {
	if val.Kind() == reflect.String && val.CanSet() {
		val.SetString(s.Parent.Value(val.String()))
	}

	return nil
}

// Struct implements reflectwalk.StructWalker
func (s *structScrubber) Struct(val reflect.Value) error {
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
			return reflectwalk.SkipEntry
		case "hash":
			setExplicitValue = true
			explicitValue = SanitiseHash(val.String())
		case "redact":
			setExplicitValue = true
			explicitValue = SanitiseRedact(val.String())
		}

		if setExplicitValue {
			if !val.CanSet() {
				return fmt.Errorf("cannot set %s", field.PkgPath)
			}
			val.SetString(explicitValue)
		} else {
			sanitisatiser := s.Parent.getSanitisatiser(field.Name)
			if sanitisatiser != nil {
				if !val.CanSet() {
					return fmt.Errorf("cannot set %s", field.PkgPath)
				}
				val.SetString(sanitisatiser(val.String()))
			}
		}
		return reflectwalk.SkipEntry
	}

	return nil
}

// Map implements reflectwalk.MapWalker
func (s *structScrubber) Map(m reflect.Value) error {
	// fix https://github.com/gitpod-io/security/issues/64
	var (
		nameV  reflect.Value
		valueK reflect.Value
		valueV reflect.Value
	)
	for _, k := range m.MapKeys() {
		kv := m.MapIndex(k)
		if k.String() == "name" {
			nameV = kv
		} else if k.String() == "value" {
			valueK = k
			valueV = kv
		}
	}
	if nameV.Kind() == reflect.Interface {
		nameV = nameV.Elem()
	}
	if valueV.Kind() == reflect.Interface {
		valueV = valueV.Elem()
	}

	if nameV.Kind() == reflect.String && valueV.Kind() == reflect.String {
		sanitisatiser := s.Parent.getSanitisatiser(nameV.String())
		if sanitisatiser != nil {
			value := sanitisatiser(valueV.String())
			m.SetMapIndex(valueK, reflect.ValueOf(value))
		}
	}
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
	}

	return nil
}
