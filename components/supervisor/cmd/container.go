package cmd

import (
	"github.com/spf13/cobra"
)

var containerCmd = &cobra.Command{
	Use:    "container",
	Short:  "groups a couple of commands called as container probes or hooks. These commands are not meant to be called directly.",
	Hidden: true,
}

func init() {
	rootCmd.AddCommand(containerCmd)
}
