package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/sshproxy"

	"github.com/spf13/cobra"
)

var sshProxyCmd = &cobra.Command{
	Use:   "ssh-proxy",
	Short: "Starts ssh-proxy",
	RunE: func(cmd *cobra.Command, args []string) error {
		log.Init("ws-proxy", "", false, true)
		return sshproxy.Run()
	},
}

func init() {
	rootCmd.AddCommand(sshProxyCmd)
}
