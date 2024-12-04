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
	"unsafe"

	lru "github.com/hashicorp/golang-lru"
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

	func (TrustedExample) IsTrustedValue() {}

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

	// DeepCopyStruct scrubes a struct with a deep copy.
	// The difference between `DeepCopyStruct` and `Struct`` is that DeepCopyStruct does not modify the structure directly,
	// but creates a deep copy instead.
	// Also, val can be a pointer or a structure.
	DeepCopyStruct(val any) any
}

type ScrubberImplConfig struct {
	HashedFieldNames         []string
	HashedURLPathsFieldNames []string
	RedactedFieldNames       []string
	HashedValues             map[string]*regexp.Regexp
	RedactedValues           map[string]*regexp.Regexp
}

// CreateCustomScrubber creates a new scrubber with the given configuration
// !!! Only use this if you know what you're doing. For all logging purposes, use the "Default" impl !!!
func CreateCustomScrubber(cfg *ScrubberImplConfig) Scrubber {
	return createScrubberImpl(cfg)
}

// Default is the default scrubber consumers of this package should use
var Default Scrubber = newScrubberImpl()

func newScrubberImpl() *scrubberImpl {
	defaultCfg := ScrubberImplConfig{
		HashedFieldNames:         HashedFieldNames,
		HashedURLPathsFieldNames: HashedURLPathsFieldNames,
		RedactedFieldNames:       RedactedFieldNames,
		HashedValues:             HashedValues,
		RedactedValues:           RedactedValues,
	}
	return createScrubberImpl(&defaultCfg)
}

func createScrubberImpl(cfg *ScrubberImplConfig) *scrubberImpl {
	var (
		lowerSanitiseHash         []string
		lowerSanitiseHashURLPaths []string
		lowerSanitiseRedact       []string
	)
	for _, v := range cfg.HashedFieldNames {
		lowerSanitiseHash = append(lowerSanitiseHash, strings.ToLower(v))
	}
	for _, v := range cfg.HashedURLPathsFieldNames {
		lowerSanitiseHashURLPaths = append(lowerSanitiseHashURLPaths, strings.ToLower(v))
	}
	for _, v := range cfg.RedactedFieldNames {
		lowerSanitiseRedact = append(lowerSanitiseRedact, strings.ToLower(v))
	}

	cache, err := lru.New(1000)
	if err != nil {
		panic(fmt.Errorf("cannot create cache: %w", err))
	}

	res := &scrubberImpl{
		LowerSanitiseHash:         lowerSanitiseHash,
		LowerSanitiseHashURLPaths: lowerSanitiseHashURLPaths,
		LowerSanitiseRedact:       lowerSanitiseRedact,
		HashedValues:              cfg.HashedValues,
		RedactedValues:            cfg.RedactedValues,
		KeySanitiserCache:         cache,
	}
	res.Walker = &structScrubber{Parent: res}

	return res
}

type scrubberImpl struct {
	Walker                    *structScrubber
	LowerSanitiseHash         []string
	LowerSanitiseHashURLPaths []string
	LowerSanitiseRedact       []string
	HashedValues              map[string]*regexp.Regexp
	RedactedValues            map[string]*regexp.Regexp
	KeySanitiserCache         *lru.Cache
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

type keySanitiser struct {
	s Sanitisatiser
}

var (
	sanitiseIgnore              keySanitiser = keySanitiser{s: nil}
	sanitiseHash                keySanitiser = keySanitiser{s: SanitiseHash}
	sanitiseHashURLPathSegments keySanitiser = keySanitiser{s: SanitiseHashURLPathSegments}
	sanitiseRedact              keySanitiser = keySanitiser{s: SanitiseRedact}
)

// getSanitisatiser implements
func (s *scrubberImpl) getSanitisatiser(key string) Sanitisatiser {
	lower := strings.ToLower(key)
	san, ok := s.KeySanitiserCache.Get(lower)
	if ok {
		w := san.(keySanitiser)
		return w.s
	}

	for _, f := range s.LowerSanitiseRedact {
		if strings.Contains(lower, f) {
			s.KeySanitiserCache.Add(lower, sanitiseRedact)
			return SanitiseRedact
		}
	}
	// Give sanitiseHashURLPathSegments precedence over sanitiseHash
	for _, f := range s.LowerSanitiseHashURLPaths {
		if strings.Contains(lower, f) {
			s.KeySanitiserCache.Add(lower, sanitiseHashURLPathSegments)
			return SanitiseHashURLPathSegments
		}
	}
	for _, f := range s.LowerSanitiseHash {
		if strings.Contains(lower, f) {
			s.KeySanitiserCache.Add(lower, sanitiseHash)
			return SanitiseHash
		}
	}

	s.KeySanitiserCache.Add(lower, sanitiseIgnore)
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

func (s *scrubberImpl) deepCopyStruct(fieldName string, src reflect.Value, scrubTag string, skipScrub bool) reflect.Value {
	if src.Kind() == reflect.Ptr && src.IsNil() {
		return reflect.New(src.Type()).Elem()
	}

	if src.CanInterface() {
		value := src.Interface()
		if _, ok := value.(TrustedValue); ok {
			skipScrub = true
		}
	}

	if src.Kind() == reflect.String && !skipScrub {
		dst := reflect.New(src.Type())
		var (
			setExplicitValue bool
			explicitValue    string
		)
		switch scrubTag {
		case "ignore":
			dst.Elem().SetString(src.String())
			if !dst.CanInterface() {
				return dst
			}
			return dst.Elem()
		case "hash":
			setExplicitValue = true
			explicitValue = SanitiseHash(src.String())
		case "redact":
			setExplicitValue = true
			explicitValue = SanitiseRedact(src.String())
		}

		if setExplicitValue {
			dst.Elem().SetString(explicitValue)
		} else {
			sanitisatiser := s.getSanitisatiser(fieldName)
			if sanitisatiser != nil {
				dst.Elem().SetString(sanitisatiser(src.String()))
			} else {
				dst.Elem().SetString(s.Value(src.String()))
			}
		}
		if !dst.CanInterface() {
			return dst
		}
		return dst.Elem()
	}

	switch src.Kind() {
	case reflect.Struct:
		dst := reflect.New(src.Type())
		t := src.Type()

		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			srcValue := src.Field(i)
			dstValue := dst.Elem().Field(i)

			if !srcValue.CanInterface() {
				dstValue = reflect.NewAt(dstValue.Type(), unsafe.Pointer(dstValue.UnsafeAddr())).Elem()

				if !srcValue.CanAddr() {
					switch {
					case srcValue.CanInt():
						dstValue.SetInt(srcValue.Int())
					case srcValue.CanUint():
						dstValue.SetUint(srcValue.Uint())
					case srcValue.CanFloat():
						dstValue.SetFloat(srcValue.Float())
					case srcValue.CanComplex():
						dstValue.SetComplex(srcValue.Complex())
					case srcValue.Kind() == reflect.Bool:
						dstValue.SetBool(srcValue.Bool())
					}

					continue
				}

				srcValue = reflect.NewAt(srcValue.Type(), unsafe.Pointer(srcValue.UnsafeAddr())).Elem()
			}

			tagValue := f.Tag.Get("scrub")
			copied := s.deepCopyStruct(f.Name, srcValue, tagValue, skipScrub)
			dstValue.Set(copied)
		}
		return dst.Elem()

	case reflect.Map:
		dst := reflect.MakeMap(src.Type())
		keys := src.MapKeys()
		for i := 0; i < src.Len(); i++ {
			mValue := src.MapIndex(keys[i])
			dst.SetMapIndex(keys[i], s.deepCopyStruct(keys[i].String(), mValue, "", skipScrub))
		}
		return dst

	case reflect.Slice:
		dst := reflect.MakeSlice(src.Type(), src.Len(), src.Cap())
		for i := 0; i < src.Len(); i++ {
			dst.Index(i).Set(s.deepCopyStruct(fieldName, src.Index(i), "", skipScrub))
		}
		return dst

	case reflect.Array:
		if src.Len() == 0 {
			return src
		}

		dst := reflect.New(src.Type()).Elem()
		for i := 0; i < src.Len(); i++ {
			dst.Index(i).Set(s.deepCopyStruct(fieldName, src.Index(i), "", skipScrub))
		}
		return dst

	case reflect.Interface:
		if src.IsNil() {
			return src
		}
		dst := reflect.New(src.Elem().Type())
		copied := s.deepCopyStruct(fieldName, src.Elem(), scrubTag, skipScrub)
		dst.Elem().Set(copied)
		return dst.Elem()

	case reflect.Ptr:
		dst := reflect.New(src.Elem().Type())
		copied := s.deepCopyStruct(fieldName, src.Elem(), scrubTag, skipScrub)
		dst.Elem().Set(copied)
		return dst

	default:
		dst := reflect.New(src.Type())
		dst.Elem().Set(src)
		return dst.Elem()
	}
}

// Struct implements Scrubber
func (s *scrubberImpl) DeepCopyStruct(val any) any {
	return s.deepCopyStruct("", reflect.ValueOf(val), "", false).Interface()
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
	for key, expr := range s.HashedValues {
		value = expr.ReplaceAllStringFunc(value, func(s string) string {
			return SanitiseHash(s, SanitiseWithKeyName(key))
		})
	}
	for key, expr := range s.RedactedValues {
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
	if !val.CanInterface() {
		return nil
	}
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
	if k.Kind() == reflect.Interface {
		k = k.Elem()
	}
	if kind == reflect.String {
		m.SetMapIndex(k, reflect.ValueOf(s.Parent.KeyValue(k.String(), v.String())))
	}

	return nil
}
