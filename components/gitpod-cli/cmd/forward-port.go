// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"

	"github.com/google/tcpproxy"
	"github.com/gorilla/handlers"
	"github.com/spf13/cobra"
)

var rewriteHostHeader bool

var portFwdCmd = &cobra.Command{
	Use:   "forward-port <local-port> [target-port]",
	Short: "Makes a port available on 0.0.0.0 so that it can be exposed to the internet",
	Long:  ``,
	Args:  cobra.RangeArgs(1, 2),
	Run: func(cmd *cobra.Command, args []string) {
		srcp, err := strconv.ParseInt(args[0], 10, 32)
		if err != nil {
			log.Fatalf("local-port cannot be parsed as int: %s", err)
			os.Exit(-1)
			return
		}
		if err := checkPortRange(srcp); err != nil {
			log.Fatalf("local-port: %s", err)
			os.Exit(-1)
			return
		}

		trgp := srcp + 1
		if len(args) > 1 {
			var err error
			trgp, err = strconv.ParseInt(args[1], 10, 32)
			if err != nil {
				log.Fatalf("target-port cannot be parsed as int: %s", err)
				os.Exit(-1)
				return
			}
			if err := checkPortRange(trgp); err != nil {
				log.Fatalf("target-port: %s", err)
				os.Exit(-1)
				return
			}
		}

		if rewriteHostHeader {
			remote, _ := url.Parse(fmt.Sprintf("http://localhost:%d", srcp))
			host := fmt.Sprintf("localhost:%d", srcp) // Spec: https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.23
			proxy := httputil.NewSingleHostReverseProxy(remote)
			originalDirector := proxy.Director
			proxy.Director = func(r *http.Request) {
				originalDirector(r)
				r.Host = host
			}
			// we want both X-Forwarded-Proto AND X-Forwarded-Host to reach the backend
			http.Handle("/", handlers.ProxyHeaders(http.HandlerFunc(proxy.ServeHTTP)))

			fmt.Printf("Proxying HTTP traffic: 0.0.0.0:%d -> 127.0.0.1:%d (with host rewriting)\n", trgp, srcp)
			err = http.ListenAndServe(fmt.Sprintf(":%d", trgp), nil)
			if err != nil {
				log.Fatalf("reverse proxy: %s", err)
			}
			return
		}

		var p tcpproxy.Proxy
		p.AddRoute(fmt.Sprintf(":%d", trgp), tcpproxy.To(fmt.Sprintf("127.0.0.1:%d", srcp)))
		fmt.Printf("Forwarding traffic: 0.0.0.0:%d -> 127.0.0.1:%d\n", trgp, srcp)
		log.Fatal(p.Run())
	},
}

func checkPortRange(prt int64) error {
	if !(0 < prt && prt < 65535) {
		return fmt.Errorf("Port is not within range: 0 < %d < 65535", prt)
	}
	return nil
}

func init() {
	rootCmd.AddCommand(portFwdCmd)
	portFwdCmd.Flags().BoolVarP(&rewriteHostHeader, "rewrite-host-header", "r", false, "rewrites the host header of passing HTTP requests to localhost")
}
