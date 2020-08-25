// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"encoding/base32"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	proto "github.com/golang/protobuf/proto"
)

// ToRef turns the spec into a "pullable" image reference
func (spec *ImageSpec) ToRef(host string) (ref string, err error) {
	if host == "" {
		return "", fmt.Errorf("host cannot be empty")
	}
	if spec != nil && len(spec.ContentLayer) != 0 {
		return "", fmt.Errorf("ToRef does not support content layer")
	}

	fc, err := json.Marshal(spec)
	if err != nil {
		return "", fmt.Errorf("cannot marshal image spec: %w", err)
	}

	cfg := base32.StdEncoding.EncodeToString(fc)
	// Docker repository names have to be lowercase
	cfg = strings.ToLower(cfg)
	// Docker repository names must use - as only seperator
	cfg = strings.ReplaceAll(cfg, "=", "-")
	// Docker repository names must end with an alphanumeric character
	cfg = strings.TrimRight(cfg, "-")

	// Docker repository names must not be longer than 255 characters.
	// We're using up two characters to mark the image spec provider.
	if len(cfg) > (255 - 2) {
		return "", fmt.Errorf("repository name must not be longer than 255 characters")
	}

	ref = fmt.Sprintf("%s/c/%s:latest", strings.TrimPrefix(host, "/"), cfg)
	return
}

// ImageSpecFromRef reproduces an image spec from a ref produced using ToRef
func ImageSpecFromRef(ref string) (spec *ImageSpec, err error) {
	if segs := strings.Split(ref, "/"); len(segs) > 1 {
		ref = segs[len(segs)-1]
	}
	ref = strings.TrimSuffix(ref, ":latest")
	if ref == "" {
		return nil, fmt.Errorf("cannot use empty ref")
	}

	// base32 must be padded to multiples of 8
	psize := len(ref)
	if psize%8 != 0 {
		psize = ((len(ref) / 8) + 1) * 8
	}
	format := fmt.Sprintf("%%-%ds", psize)
	ref = strings.ReplaceAll(fmt.Sprintf(format, ref), " ", "=")

	// base32 is uppercase
	ref = strings.ToUpper(ref)

	rawSpec, err := base32.StdEncoding.DecodeString(ref)
	if err != nil {
		return nil, fmt.Errorf("cannot decode ref \"%s\": %w", ref, err)
	}

	var s ImageSpec
	err = json.Unmarshal(rawSpec, &s)
	if err != nil {
		return nil, fmt.Errorf("cannot unmarshal ref: %w", err)
	}

	return &s, nil
}

// ToBase64 marshals the image spec using protobuf and encodes it in base64
func (spec *ImageSpec) ToBase64() (res string, err error) {
	if spec == nil {
		return
	}

	rspec, err := proto.Marshal(spec)
	if err != nil {
		return "", fmt.Errorf("cannot marshal image spec: %w", err)
	}

	return base64.StdEncoding.EncodeToString(rspec), nil
}

// ImageSpecFromBase64 decodes an image specification from a base64 encoded protobuf message
func ImageSpecFromBase64(input string) (res *ImageSpec, err error) {
	if len(input) == 0 {
		return
	}

	specPB, err := base64.StdEncoding.DecodeString(input)
	if err != nil {
		return nil, fmt.Errorf("cannot decode image spec: %w", err)
	}

	var spec ImageSpec
	err = proto.Unmarshal(specPB, &spec)
	if err != nil {
		return nil, fmt.Errorf("cannot unmarshal image spec: %w", err)
	}

	return &spec, nil
}
