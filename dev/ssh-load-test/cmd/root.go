package cmd

import (
	"net/url"
	"strings"

	"github.com/helloyi/go-sshclient"
	"github.com/spf13/cobra"
)

var wsUrlStr string
var ownerToken string

var rootCmd = &cobra.Command{
	Use:   "newCLI",
	Short: "A brief description of your application",
	Long:  "",
}

func Execute() {
	cobra.CheckErr(rootCmd.Execute())
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&wsUrlStr, "url", "u", "", "Url of workspace")
	rootCmd.PersistentFlags().StringVarP(&ownerToken, "token", "t", "", "Owner token of workspace")
}

func connSSH() (*sshclient.Client, error) {
	wsUrl, err := url.Parse(wsUrlStr)
	if err != nil {
		panic(err)
	}
	host := wsUrl.Host
	wsID := strings.Split(wsUrl.Host, ".")[0]
	cli, err := sshclient.DialWithPasswd(host+":22", wsID, ownerToken)
	return cli, err
}
