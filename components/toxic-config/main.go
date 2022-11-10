// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"flag"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"

	toxiproxy "github.com/Shopify/toxiproxy/v2/client"
)

var (
	proxyName string
	latency   int
	jitter    int
	wait      bool
)

func main() {
	flag.StringVar(&proxyName, "proxy", "mysql", "the name of the proxy to which latency should be added")
	flag.IntVar(&latency, "latency", 1000, "latency in milliseconds")
	flag.IntVar(&jitter, "jitter", 250, "jitter in milliseconds")
	flag.BoolVar(&wait, "wait", false, "whether the process should wait indefinitely after running")

	flag.Parse()

	client := toxiproxy.NewClient(":8474")

	var (
		proxies map[string]*toxiproxy.Proxy
		err     error
	)
	for {
		proxies, err = client.Proxies()
		if err != nil {
			log.WithError(err).Print("Failed to list proxies")
			log.Println("Retrying in 1s...")
			time.Sleep(1 * time.Second)
		} else {
			break
		}
	}

	proxy, ok := proxies[proxyName]
	if !ok {
		log.Fatalf("Failed to find proxy %q", proxyName)
	}

	toxic, err := proxy.AddToxic(
		"latency",
		"latency",
		"downstream",
		1.0,
		toxiproxy.Attributes{"latency": latency, "jitter": jitter},
	)
	if err != nil {
		log.Fatalf("Failed to add toxic: %s", err)
	}

	log.Printf("Toxic added: %s", toxic.Name)

	if wait {
		select {}
	}
}
