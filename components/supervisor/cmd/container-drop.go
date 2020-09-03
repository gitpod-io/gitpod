package cmd

import (
	"io"
	"os"

	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"
	"github.com/spf13/cobra"
)

var dropCmd = &cobra.Command{
	Use:    "drop",
	Short:  "starts a dropping rate-limiter for stdin",
	Hidden: true,
	Run: func(cmd *cobra.Command, args []string) {
		out := dropwriter.Writer(os.Stdout, dropwriter.NewBucket(128, 64))
		io.Copy(out, os.Stdin)
	},
}

func init() {
	containerCmd.AddCommand(dropCmd)
}
