// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/authzed/spicedb/pkg/development"
	"github.com/authzed/spicedb/pkg/namespace"
	corev1 "github.com/authzed/spicedb/pkg/proto/core/v1"
	dev_v1 "github.com/authzed/spicedb/pkg/proto/developer/v1"
	implv1 "github.com/authzed/spicedb/pkg/proto/impl/v1"
	"github.com/authzed/spicedb/pkg/schemadsl/compiler"
	"gopkg.in/yaml.v2"
)

type Schema struct {
	Schema string `yaml:"schema"`
}

func main() {
	schema := GetCompiledSchema()
	fmt.Print(GenerateDefinition(schema))
}

func GetCompiledSchema() *compiler.CompiledSchema {
	// read schemaFile
	b, err := os.ReadFile("../schema/schema.yaml")
	if err != nil {
		panic(err)
	}

	var schema Schema
	err = yaml.Unmarshal(b, &schema)
	if err != nil {
		panic(err)
	}

	devCtx, devErrs, err := development.NewDevContext(context.Background(), &dev_v1.RequestContext{
		Schema:        schema.Schema,
		Relationships: nil,
	})
	if err != nil {
		panic(err)
	}
	if devErrs != nil {
		panic(errors.New(devErrs.InputErrors[0].Message))
	}
	return devCtx.CompiledSchema
}

func GenerateDefinition(schema *compiler.CompiledSchema) string {

	resource := "export type ResourceType ="
	relation := "export type Relation ="
	permission := "export type Permission ="
	other := ""
	fluentApi := ""

	// list definitions
	for _, def := range schema.ObjectDefinitions {
		// make sure the first character is upper case
		simpleName := strings.ToUpper(string(def.Name[0])) + def.Name[1:]
		resourceTypeName := simpleName + "ResourceType"
		resource += "\n  | " + resourceTypeName + ""
		other += "\nexport type " + resourceTypeName + " = \"" + def.Name + "\";\n"
		fluentApi += "\n" + generateFluentAPI(def)
		// check if relations exists
		hasRelations := false
		for _, rel := range def.Relation {
			if namespace.GetRelationKind(rel) == implv1.RelationMetadata_RELATION {
				hasRelations = true
				break
			}
		}
		if hasRelations {
			relation += "\n  | " + simpleName + "Relation"
			other += "\nexport type " + simpleName + "Relation ="
			for _, rel := range def.Relation {
				if namespace.GetRelationKind(rel) == implv1.RelationMetadata_RELATION {
					other += "\n     | \"" + rel.Name + "\""
				}
			}
			other += ";\n"
		}
		// check if permissions exists
		hasPermissions := false
		for _, rel := range def.Relation {
			if namespace.GetRelationKind(rel) == implv1.RelationMetadata_PERMISSION {
				hasPermissions = true
				break
			}
		}
		if hasPermissions {
			permission += "\n  | " + simpleName + "Permission"
			// permissions
			other += "\nexport type " + simpleName + "Permission ="
			for _, rel := range def.Relation {
				if namespace.GetRelationKind(rel) == implv1.RelationMetadata_PERMISSION {
					other += "\n     | \"" + rel.Name + "\""
				}
			}
			other += ";\n"
		}
	}

	return `
		/**
		* Copyright (c) 2023 Gitpod GmbH. All rights reserved.
		* Licensed under the GNU Affero General Public License (AGPL).
		* See License.AGPL.txt in the project root for license information.
		*/

		import { v1 } from "@authzed/authzed-node";

		export const InstallationID = "1";

		` + resource + `;

		` + relation + `;

		` + permission + `;

		` + other + `

		export const rel = {
			` + fluentApi + `
		};
		`
}

func generateFluentAPI(def *corev1.NamespaceDefinition) string {
	ifElse := func(cond bool, ifTrue string, ifFalse string) string {
		if cond {
			return ifTrue
		}
		return ifFalse
	}

	relations := ""
	for _, rel := range def.Relation {
		if namespace.GetRelationKind(rel) != implv1.RelationMetadata_RELATION {
			continue
		}

		objects := ``
		for _, t := range rel.TypeInformation.AllowedDirectRelations {
			objects += `
				` + ifElse(t.Namespace == "installation",
				"get "+t.Namespace+"()",
				t.Namespace+"(objectId: string)") + ` {
				return {
					...result2,
					subject: {
						object: {
							objectType: "` + t.Namespace + `",
							objectId: ` + ifElse(t.Namespace == "installation", `"1"`, "objectId") + `,
						},
					},
				} as v1.Relationship;
			},`
		}

		relations += `
			get ` + rel.Name + `() {
				const result2 = {
                    ...result,
                    relation: "` + rel.Name + `",
                };
				return {
					` + objects + `
				};
			},

		`
	}

	return `
	` + ifElse(def.Name == "installation",
		`get `+def.Name+`() {`,
		``+def.Name+`(id: string) {`) + `
		const result: Partial<v1.Relationship> = {
			resource: {
				objectType: "` + def.Name + `",
				objectId: ` + ifElse(def.Name == "installation", `"1"`, "id") + `
			},
		};
		return {
			` + relations + `
		};
	},
`
}
