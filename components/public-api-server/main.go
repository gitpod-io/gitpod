// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"net/http"
)

func main() {
	addr := ":9000"
	err := http.ListenAndServe(addr, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`hello world`))
	}))
	if err != nil {
		fmt.Println("Failed to server on", addr, err)
	}
}
