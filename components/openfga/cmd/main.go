package main

import (
	"log"
	"os"

	openfga "github.com/openfga/go-sdk"
)

func main() {

	err := load(loadOpts{
		teams:   15000,
		members: 155,
	})
	if err != nil {
		log.Fatal(err)
	}

}

type loadOpts struct {
	teams   int
	members int
}

func load(opts loadOpts) error {
	configuration, err := openfga.NewConfiguration(openfga.Configuration{
		ApiScheme: os.Getenv("OPENFGA_API_SCHEME"), // optional, defaults to "https"
		ApiHost:   os.Getenv("OPENFGA_API_HOST"),   // required, define without the scheme (e.g. api.fga.example instead of https://api.fga.example)
		StoreId:   os.Getenv("OPENFGA_STORE_ID"),   // not needed when calling `CreateStore` or `ListStores`
	})
	if err != nil {
		return err
	}

	return nil

}
