package main

import (
	"log"
	"net/http"

	"github.com/sosedoff/gitkit"
)

func main() {
	// Configure git service
	service := gitkit.New(gitkit.Config{
		Dir:        "/workspace",
		AutoCreate: true,
	})

	// Configure git server. Will create git repos path if it does not exist.
	// If hooks are set, it will also update all repos with new version of hook scripts.
	if err := service.Setup(); err != nil {
		log.Fatal(err)
	}

	http.Handle("/", service)

	// Start HTTP server
	if err := http.ListenAndServe(":9999", nil); err != nil {
		log.Fatal(err)
	}
}
