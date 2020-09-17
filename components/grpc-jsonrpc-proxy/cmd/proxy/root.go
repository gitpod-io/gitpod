package cmd

import (
	"fmt"
	"net"
	"net/http"
	"os"

	"github.com/gitpod/gitpod-io/grpc-jsonrpc-proxy/pkg/proxy"
	"github.com/gorilla/websocket"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "grpc-jsonrpc-proxy <listen-addr>",
	Short: "Starts the grpc-jsonrpc-proxy",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		l, err := net.Listen("tcp", args[0])
		if err != nil {
			return err
		}

		pxy := proxy.WebsocketProxy{
			Config: proxy.Config {
				Endpoint: "localhost:22999",
			},
			Upgrader: &websocket.Upgrader{
				CheckOrigin: func(r *http.Request) bool { return true },
			},
		}
		return pxy.Serve(l)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {

}
