package main

import (
	"context"
	"fmt"
	"io/ioutil"

	"github.com/authzed/spicedb/pkg/development"
	devinterface "github.com/authzed/spicedb/pkg/proto/developer/v1"
	"gopkg.in/yaml.v3"
)

type Schema struct {
	Schema string `yaml:"schema"`
}

func main() {
	schemaFile := "/workspace/gitpod/install/installer/pkg/components/spicedb/data/schema.yaml"

	b, err := ioutil.ReadFile(schemaFile)
	if err != nil {
		panic(err)
	}

	var schema Schema
	err = yaml.Unmarshal(b, &schema)
	if err != nil {
		panic(err)
	}

	devCtx, devErrs, err := development.NewDevContext(context.Background(), &devinterface.RequestContext{
		Schema:        schema.Schema,
		Relationships: nil,
	})
	if err != nil {
		panic(err)
	}
	fmt.Println("dev errs", devErrs)

	fmt.Println(devCtx.CompiledSchema)
}
