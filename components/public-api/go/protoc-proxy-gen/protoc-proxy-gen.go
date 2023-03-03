// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"path"

	"google.golang.org/protobuf/compiler/protogen"
	"google.golang.org/protobuf/types/pluginpb"
)

const (
	contextPackage = protogen.GoImportPath("context")
	connectPackage = protogen.GoImportPath("github.com/bufbuild/connect-go")
)

func main() {
	protogen.Options{}.Run(func(gen *protogen.Plugin) error {
		gen.SupportedFeatures = uint64(pluginpb.CodeGeneratorResponse_FEATURE_PROTO3_OPTIONAL)

		for _, f := range gen.Files {
			if !f.Generate {
				continue
			}
			generateFile(gen, f)
		}
		return nil
	})
}

func generateFile(gen *protogen.Plugin, file *protogen.File) {
	// We only generate our proxy implementation for services, not for raw structs
	if len(file.Services) == 0 {
		return
	}

	var (
		targetPackageName = fmt.Sprintf("%sconnect", file.GoPackageName)

		filename = path.Join(
			path.Dir(file.GeneratedFilenamePrefix),
			targetPackageName,
			fmt.Sprintf("%s.proxy.connect.go", path.Base(file.GeneratedFilenamePrefix)))
		importPath = protogen.GoImportPath(path.Join(string(file.GoImportPath), string(file.GoPackageName)))
	)

	// Setup a new generated file
	g := gen.NewGeneratedFile(filename, importPath)

	// generate preamble
	g.P("// Code generated by protoc-gen-connect-proxy. DO NOT EDIT.")
	g.P()
	g.P("package ", targetPackageName)
	g.P()
	g.Import(file.GoImportPath)
	g.P()

	// generate individual services
	for _, service := range file.Services {
		// generate struct definition
		handlerStructName := "Proxy" + service.GoName + "Handler"

		// Generate a type assertion to ensure the handler implements the connect handler interface
		g.P("var _ " + service.GoName + "Handler" + " = (*" + handlerStructName + ")(nil)")

		g.Annotate(handlerStructName, service.Location)
		g.P("type " + handlerStructName + " struct {")
		g.P("	Client " + g.QualifiedGoIdent(file.GoImportPath.Ident(service.GoName+"Client")))
		g.P("	Unimplemented" + service.GoName + "Handler")
		g.P("}")
		g.P()

		for _, method := range service.Methods {
			// We do not generate any non-unary methods, for now.
			// Should we need these, we can choose to do so and handle them explicitly.
			// The handler still continues to work fine, as it inhertis from the default Unimplemented handling, and will
			// always return Unimplemented.
			if method.Desc.IsStreamingClient() || method.Desc.IsStreamingServer() {
				continue
			}

			// method signature
			g.P(fmt.Sprintf("func (s *%s) %s(ctx %s, req *%s) (*%s, error) {",
				handlerStructName,
				method.GoName,
				g.QualifiedGoIdent(contextPackage.Ident("Context")),
				g.QualifiedGoIdent(connectPackage.Ident("Request"))+"["+g.QualifiedGoIdent(method.Input.GoIdent)+"]",
				g.QualifiedGoIdent(connectPackage.Ident("Response"))+"["+g.QualifiedGoIdent(method.Output.GoIdent)+"]",
			))

			// method implementation
			g.P(fmt.Sprintf("	resp, err := s.Client.%s(ctx, req.Msg)", method.GoName))
			g.P("	if err != nil {")
			g.P("		// TODO(milan): Convert to correct status code")
			g.P("		return nil, err")
			g.P("	}")
			g.P()
			g.P(fmt.Sprintf("	return %s(resp), nil", g.QualifiedGoIdent(connectPackage.Ident("NewResponse"))))

			// method end
			g.P("}")
			g.P()
		}
	}
}
