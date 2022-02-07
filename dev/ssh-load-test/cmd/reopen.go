package cmd

import (
	"io"
	"log"
	"time"

	"github.com/spf13/cobra"
)

var concurrentNum int32

var reopenCmd = &cobra.Command{
	Use:   "reopen",
	Short: "try dropping and reopening connections to see whether ws-proxy leaks memory on such connections",
	Run: func(cmd *cobra.Command, args []string) {
		for i := 0; i < int(concurrentNum); i++ {
			go func(i int) {
				for {
					cli, err := connSSH()
					if err != nil {
						log.Println("[error]", i, "open ssh failed", err)
						return
					}
					err = cli.Cmd("date").Run()
					if err != nil && err != io.EOF {
						log.Println("[error]", i, "exec cmd failed", err)
						return
					}
					err = cli.Close()
					if err != nil {
						log.Println("[error]", i, "close ssh failed", err)
						return
					}
					time.Sleep(1 * time.Second)
				}
			}(i)
			time.Sleep(10 * time.Millisecond)
		}
		select {}
	},
}

func init() {
	rootCmd.AddCommand(reopenCmd)
	rootCmd.PersistentFlags().Int32VarP(&concurrentNum, "concurrent", "c", 1, "Number of concurrent connection")
}
