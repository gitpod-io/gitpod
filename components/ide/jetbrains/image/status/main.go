// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"
)

// proxy for the Code With Me status endpoints that transforms it into the supervisor status format.
func main() {
	if len(os.Args) < 2 {
		fmt.Printf("Usage: %s <port> [<link label>]\n", os.Args[0])
		os.Exit(1)
	}
	port := os.Args[1]
	label := "Open JetBrains IDE"
	if len(os.Args) > 2 {
		label = os.Args[2]
	}

	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		var (
			url    = "http://localhost:63342/codeWithMe/unattendedHostStatus?token=gitpod"
			client = http.Client{Timeout: 1 * time.Second}
		)
		resp, err := client.Get(url)
		if err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		defer resp.Body.Close()

		bodyBytes, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}

		if resp.StatusCode != http.StatusOK {
			// log.Printf("Desktop IDE status proxy: getting non-200 status - %d\n%s\n", resp.StatusCode, bodyBytes)
			http.Error(w, string(bodyBytes), resp.StatusCode)
			return
		}

		type Projects struct {
			JoinLink string `json:"joinLink"`
		}
		type Response struct {
			Projects []Projects `json:"projects"`
		}
		jsonResp := &Response{}
		err = json.Unmarshal(bodyBytes, &jsonResp)

		if err != nil {
			http.Error(w, "Error parsing JSON body from IDE status probe.", http.StatusServiceUnavailable)
			return
		}
		if len(jsonResp.Projects) != 1 {
			http.Error(w, "projects size != 1", http.StatusServiceUnavailable)
			return
		}
		response := make(map[string]string)
		response["link"] = jsonResp.Projects[0].JoinLink
		response["label"] = label
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	fmt.Printf("Starting status proxy for desktop IDE at port %s\n", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), nil); err != nil {
		log.Fatal(err)
	}
}
