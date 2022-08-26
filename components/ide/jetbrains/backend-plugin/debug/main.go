// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	body, err := os.Open("/workspace/gitpod/components/ide/jetbrains/backend-plugin/build/distributions/gitpod-remote-0.0.1.zip")
	if err != nil {
		log.Fatal(err)
	}
	defer body.Close()

	req, err := http.NewRequest("POST", "24000-workspaceUrl/debug/upload", body)
	if err != nil {
		log.Fatal(err)
	}
	req.Header.Set("x-gitpod-owner-token", "lalala")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatal(err)
	}
	log.Print(resp.StatusCode, resp.Status)
}
