// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/kedge/pkg/registration"
	"github.com/spf13/cobra"
)

var registerReq registration.Request

// registerCmd represents the collect command
var registerCmd = &cobra.Command{
	Use:   "register <other-url-incl-/register>",
	Short: "sends a registration request to another Kedge instance",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		body, err := json.Marshal(registerReq)
		if err != nil {
			log.WithError(err).Fatal("cannot marshal request")
		}

		url := args[0]
		tkn, _ := cmd.Flags().GetString("other-token")
		req, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			log.WithError(err).Fatal("cannot create request")
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tkn))

		var client = &http.Client{Timeout: time.Second * 10}
		resp, err := client.Do(req)
		if err != nil {
			log.WithError(err).Fatal("registration request failed")
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			bd, _ := ioutil.ReadAll(resp.Body)
			log.WithField("status", resp.Status).WithField("body", strings.TrimSpace(string(bd))).Fatal("registration failed")
		}
	},
}

func init() {
	rootCmd.AddCommand(registerCmd)

	registerCmd.Flags().String("other-token", "", "token used to authenticate against the other Kedge installation")
	registerCmd.Flags().StringVar(&registerReq.URL, "our-url", "http://localhost:8080/services", "services URL of the Kedge installation we are registering, including the /services path")
	registerCmd.Flags().StringVar(&registerReq.Token, "our-token", "", "token used to query the services URL we're registering")
	registerCmd.Flags().StringVar(&registerReq.Name, "our-name", "", "name under which we want to register")
	registerCmd.Flags().StringVar(&registerReq.Suffix, "our-suffix", "", "service suffix which we'll occupy in the other cluster")
}
