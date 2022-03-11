// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"errors"
	"fmt"

	"google.golang.org/protobuf/compiler/protogen"
	"google.golang.org/protobuf/types/pluginpb"
)

func main() {
	protogen.Options{}.Run(func(p *protogen.Plugin) error {
		// enable support for optional proto3 fields
		p.SupportedFeatures = uint64(pluginpb.CodeGeneratorResponse_FEATURE_PROTO3_OPTIONAL)

		for _, f := range p.Files {
			if !f.Generate {
				continue
			}

			for _, s := range f.Services {
				for _, m := range s.Methods {
					err := validateMethod(m)
					if err != nil {
						return err
					}
				}
			}
		}

		return nil
	})
}

var (
	errMissingResponseStatus = errors.New("missing response status field.\nPlease add the following to the message:\n\tgoogle.rpc.Status response_status = 1;")
)

func validateMethod(m *protogen.Method) (err error) {
	defer func() {
		if err == nil {
			return
		}

		err = fmt.Errorf("%s: %w", m.Output.Desc.FullName(), err)
	}()

	fields := m.Output.Fields
	if len(fields) == 0 {
		return errMissingResponseStatus
	}
	ff := fields[0]
	if ff.Message.Desc.FullName() != "google.rpc.Status" {
		return fmt.Errorf("first field has wrong type (\"%s\" instead of \"google.rpc.Status\").\nPlease add the following to the message:\n\tgoogle.rpc.Status response_status = 1;", ff.Message.Desc.FullName())
	}
	if ff.Desc.Name() != "response_status" {
		return fmt.Errorf("response status field has wrong name.\nPlease rename the \"%s\" field to \"response_status\"", fields[0].Desc.Name())
	}

	return nil
}
