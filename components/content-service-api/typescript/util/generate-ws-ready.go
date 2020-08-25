//go:generate sh -c "go run generate-ws-ready.go > ../../../gitpod-protocol/src/wsready.ts"

package main

import (
	"github.com/32leaves/bel"
	"github.com/gitpod-io/gitpod/content-service/api"
)

func main() {
	handler, err := bel.NewParsedSourceEnumHandler("../../go")
	if err != nil {
		panic(err)
	}

	ts, err := bel.Extract(api.WorkspaceReadyMessage{},
		bel.WithEnumerations(handler),
	)
	if err != nil {
		panic(err)
	}

	err = bel.Render(ts)
	if err != nil {
		panic(err)
	}
}
