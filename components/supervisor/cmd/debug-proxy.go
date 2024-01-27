// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

func NewSingleHostReverseProxy(target *url.URL) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		if _, ok := req.Header["User-Agent"]; !ok {
			// explicitly disable User-Agent so it's not set to default value
			req.Header.Set("User-Agent", "")
		}
		req.Header.Del("X-WS-Proxy-Debug-Port")
	}
	return &httputil.ReverseProxy{Director: director}
}

var debugProxyCmd = &cobra.Command{
	Use:   "debug-proxy",
	Short: "forward request to debug workspace",
	Run: func(cmd *cobra.Command, args []string) {
		log.Fatal(http.ListenAndServe(":23003", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			portStr := r.Header.Get("X-WS-Proxy-Debug-Port")
			port, err := strconv.Atoi(portStr)
			if err != nil || port < 1 || port > 65535 {
				w.WriteHeader(502)
				return
			}
			dst, err := url.Parse("http://localhost:" + portStr)
			if err != nil {
				w.WriteHeader(502)
				return
			}
			fmt.Printf("%+v\n", dst)
			proxy := NewSingleHostReverseProxy(dst)
			proxy.ServeHTTP(w, r)
		})))
	},
}

func init() {
	rootCmd.AddCommand(debugProxyCmd)
}
