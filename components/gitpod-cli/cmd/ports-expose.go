// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"

	"github.com/google/tcpproxy"
	"github.com/gorilla/handlers"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

var rewriteHostHeader bool

var portExposeCmd = &cobra.Command{
	Use:   "expose <local-port> [target-port]",
	Short: "Makes a port available on 0.0.0.0 so that it can be exposed to the internet",
	Long:  ``,
	Args:  cobra.RangeArgs(1, 2),
	RunE: func(cmd *cobra.Command, args []string) error {
		srcp, err := strconv.ParseUint(args[0], 10, 16)
		if err != nil {
			return xerrors.Errorf("local-port cannot be parsed as int: %w", err)
		}

		trgp := srcp + 1
		if len(args) > 1 {
			var err error
			trgp, err = strconv.ParseUint(args[1], 10, 16)
			if err != nil {
				return xerrors.Errorf("target-port cannot be parsed as int: %w", err)
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

			server := http.Server{
				Addr:    fmt.Sprintf(":%d", trgp),
				Handler: handlers.ProxyHeaders(http.HandlerFunc(proxy.ServeHTTP)),
			}
			fmt.Printf("Proxying HTTP traffic: 0.0.0.0:%d -> 127.0.0.1:%d (with host rewriting)\n", trgp, srcp)
			errchan := make(chan error)
			go func() {
				err := server.ListenAndServe()
				errchan <- err
			}()

			select {
			case <-cmd.Context().Done():
				server.Close()
			case err := <-errchan:
				return xerrors.Errorf("reverse proxy failed: %w", err)
			}
			return nil
		}

		var p tcpproxy.Proxy
		p.AddRoute(fmt.Sprintf(":%d", trgp), tcpproxy.To(fmt.Sprintf("127.0.0.1:%d", srcp)))
		fmt.Printf("Forwarding traffic: 0.0.0.0:%d -> 127.0.0.1:%d\n", trgp, srcp)
		errchan := make(chan error)
		go func() {
			err := p.Run()
			errchan <- err
		}()
		select {
		case <-cmd.Context().Done():
			p.Close()
		case err := <-errchan:
			return xerrors.Errorf("reverse proxy failed: %w", err)
		}
		return nil
	},
}

var portExposeCmdAlias = &cobra.Command{
	Hidden:     true,
	Deprecated: "please use `ports expose` instead.",
	Use:        "forward-port <local-port> [target-port]",
	Short:      portExposeCmd.Short,
	Long:       portExposeCmd.Long,
	Args:       portExposeCmd.Args,
	RunE:       portExposeCmd.RunE,
}

func init() {
	portsCmd.AddCommand(portExposeCmd)
	portExposeCmd.Flags().BoolVarP(&rewriteHostHeader, "rewrite-host-header", "r", false, "rewrites the host header of passing HTTP requests to localhost")

	rootCmd.AddCommand(portExposeCmdAlias)
	portExposeCmdAlias.Flags().BoolVarP(&rewriteHostHeader, "rewrite-host-header", "r", false, "rewrites the host header of passing HTTP requests to localhost")
}
