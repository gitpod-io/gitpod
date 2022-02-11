// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"encoding/base64"

	"golang.org/x/xerrors"
	"google.golang.org/protobuf/proto"
)

// ToBase64 marshals the workspace image spec using protobuf and encodes it in base64
func (spec *BuildRequest) ToBase64() (res string, err error) {
	if spec == nil {
		return
	}

	rspec, err := proto.Marshal(spec)
	if err != nil {
		return "", xerrors.Errorf("cannot marshal image spec: %w", err)
	}

	return base64.StdEncoding.EncodeToString(rspec), nil
}

// BuildRequestFromBase64 decodes an image specification from a base64 encoded protobuf message
func BuildRequestFromBase64(input string) (res *BuildRequest, err error) {
	if len(input) == 0 {
		return
	}

	specPB, err := base64.StdEncoding.DecodeString(input)
	if err != nil {
		return nil, xerrors.Errorf("cannot decode image spec: %w", err)
	}

	var spec BuildRequest
	err = proto.Unmarshal(specPB, &spec)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal image spec: %w", err)
	}

	return &spec, nil
}
