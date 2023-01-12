package main

import (
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
}
