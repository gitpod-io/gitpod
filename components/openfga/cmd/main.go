package main

import (
	"context"
	"fmt"
	"log"
	"os"

	openfga "github.com/openfga/go-sdk"
)

func main() {

	err := run()
	if err != nil {
		log.Fatal(err)
	}

}

type loadOpts struct {
	teams   int
	members int
}

func run() error {
	configuration, err := openfga.NewConfiguration(openfga.Configuration{
		ApiScheme: os.Getenv("OPENFGA_API_SCHEME"), // optional, defaults to "https"
		ApiHost:   os.Getenv("OPENFGA_API_HOST"),   // required, define without the scheme (e.g. api.fga.example instead of https://api.fga.example)
		StoreId:   os.Getenv("OPENFGA_STORE_ID"),   // not needed when calling `CreateStore` or `ListStores`
	})
	if err != nil {
		return err
	}

	client := openfga.NewAPIClient(configuration)

	return nil

}

func load(client openfga.OpenFgaApi, opts loadOpts) error {
	ctx := context.Background()
	for teamID := 0; teamID < opts.teams; teamID++ {
		for userID := 0; userID < opts.members; userID++ {
			var membership *openfga.TupleKey

			if userID < 5 {
				// first 5 members are owners
				membership = tup(user(userID), "owner", team(teamID))
			} else {
				membership = tup(user(userID), "member", team(teamID))
			}

			cellOwnership := tup("cell:global", "cell", team(teamID))

			req := openfga.WriteRequest{
				Writes: openfga.NewTupleKeys([]openfga.TupleKey{
					membership,
					cellOwnership,
				}),
				Deletes: nil,
			}
			data, response, err := client.Write(ctx).Body(req).Execute()
			if err != nil {
				return err
			}
			fmt.Println(data, response)
		}
	}
}

func user(id int) string {
	return fmt.Sprintf("user:%d", id)
}

func team(id int) string {
	return fmt.Sprintf("team:%d", id)
}

func tup(user, relation, object string) openfga.TupleKey {
	return openfga.TupleKey{
		User:     openfga.PtrString(user),
		Relation: openfga.PtrString(relation),
		Object:   openfga.PtrString(object),
	}
}
