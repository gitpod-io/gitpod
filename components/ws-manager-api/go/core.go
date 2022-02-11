// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"encoding/base64"

	"golang.org/x/xerrors"
	"google.golang.org/protobuf/proto"
)

// ToBase64 marshals the image spec using protobuf and encodes it in base64
func (spec *ExposedPorts) ToBase64() (res string, err error) {
	if spec == nil {
		return
	}

	rspec, err := proto.Marshal(spec)
	if err != nil {
		return "", xerrors.Errorf("cannot marshal image spec: %w", err)
	}

	return base64.StdEncoding.EncodeToString(rspec), nil
}

// ExposedPortsFromBase64 decodes an image specification from a base64 encoded protobuf message
func ExposedPortsFromBase64(input string) (res *ExposedPorts, err error) {
	if len(input) == 0 {
		return
	}

	specPB, err := base64.StdEncoding.DecodeString(input)
	if err != nil {
		return nil, xerrors.Errorf("cannot decode image spec: %w", err)
	}

	var spec ExposedPorts
	err = proto.Unmarshal(specPB, &spec)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal image spec: %w", err)
	}

	return &spec, nil
}

// ToBase64 marshals the WorkspaceImageStatus using protobuf and encodes it in base64
func (spec *WorkspaceImageStatus) ToBase64() (res string, err error) {
	if spec == nil {
		return
	}

	rspec, err := proto.Marshal(spec)
	if err != nil {
		return "", xerrors.Errorf("cannot marshal image spec: %w", err)
	}

	return base64.StdEncoding.EncodeToString(rspec), nil
}

// WorkspaceImageStatusFromBase64 decodes an WorkspaceImageStatus from a base64 encoded protobuf message
func WorkspaceImageStatusFromBase64(input string) (res *WorkspaceImageStatus, err error) {
	if len(input) == 0 {
		return
	}

	specPB, err := base64.StdEncoding.DecodeString(input)
	if err != nil {
		return nil, xerrors.Errorf("cannot decode image spec: %w", err)
	}

	var spec WorkspaceImageStatus
	err = proto.Unmarshal(specPB, &spec)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal image spec: %w", err)
	}

	return &spec, nil
}
