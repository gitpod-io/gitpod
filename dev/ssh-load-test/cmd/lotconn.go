package cmd

import (
	"io"
	"log"
	"time"

	"github.com/spf13/cobra"
)

var connNum int32

var lotconnCmd = &cobra.Command{
	Use:   "lotconn",
	Short: "many connections to learn the cost of single connection in terms of memory and CPU",
	Run: func(cmd *cobra.Command, args []string) {
		// for num -> start connection
		for i := 0; i < int(connNum); i++ {
			go func(i int) {
				cli, err := connSSH()
				if err != nil {
					log.Println("[error]", i, "connSSH failed", err)
					return
				}
				for {
					_, err := cli.Cmd("date").Output()
					if err != nil && err != io.EOF {
						log.Println("[error]", i, err)
						time.Sleep(1 * time.Second)
						continue
					}
					// log.Println("[debug]", string(out))
					time.Sleep(1 * time.Second)
				}
			}(i)
			time.Sleep(10 * time.Millisecond)
		}
		select {}
	},
}

func init() {
	rootCmd.AddCommand(lotconnCmd)
	rootCmd.PersistentFlags().Int32VarP(&connNum, "num", "n", 1, "Number of connection")
}
