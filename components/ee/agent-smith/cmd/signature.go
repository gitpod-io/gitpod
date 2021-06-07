package cmd

import (
	"github.com/spf13/cobra"
)

// signatureCmd represents the signature command
var signatureCmd = &cobra.Command{
	Use:   "signature",
	Short: "makes working with signatures easier",
	Args:  cobra.MinimumNArgs(1),
}

func init() {
	rootCmd.AddCommand(signatureCmd)
}
