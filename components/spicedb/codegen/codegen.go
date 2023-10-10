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
	dev_v1 "github.com/authzed/spicedb/pkg/proto/developer/v1"
	"github.com/authzed/spicedb/pkg/schemadsl/compiler"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v2"
)

type Schema struct {
	Schema string `yaml:"schema"`
}

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "codegen",
	Short: "Generates code for spicedb clients",
	Args:  cobra.MinimumNArgs(1),
}

func init() {
	rootCmd.PersistentFlags().StringP("lang", "l", "ts", "The language to generate code for. One of: ts|go")
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
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

func firstUpper(in string) string {
	return strings.ToUpper(string(in[0])) + in[1:]
}
