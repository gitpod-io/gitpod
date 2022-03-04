// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
)

// clustersRegisterCmd represents the clustersRegisterCmd command
var clustersRegisterCmd = &cobra.Command{
	Use:   "register",
	Short: "Register a cluster",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		request := &api.RegisterRequest{}

		file, err := cmd.Flags().GetString("from-file")
		if err != nil {
			log.Fatal(err)
		}

		if len(file) > 0 {
			if file == "-" {
				err := json.NewDecoder(os.Stdin).Decode(&request)
				if err != nil {
					log.Fatal(err)
				}
			} else {
				content, err := ioutil.ReadFile(file)
				if err != nil {
					log.Fatal(err)
				}
				err = json.Unmarshal([]byte(content), &request)
				if err != nil {
					log.Fatal(err)
				}
			}
		}

		name, err := cmd.Flags().GetString("name")
		if err != nil {
			log.Fatal(err)
		}
		if len(name) < 1 && len(request.Name) < 1 {
			log.Fatal("please set the cluster name with flag --name")
		}
		if len(name) > 0 {
			request.Name = name
		}

		url, err := cmd.Flags().GetString("url")
		if err != nil {
			log.Fatal(err)
		}
		if len(url) < 1 && len(request.Url) < 1 {
			log.Fatal("please set the cluster url with flag --url")
		}
		if len(url) > 0 {
			request.Url = url
		}

		tlsPath, err := cmd.Flags().GetString("tls-path")
		if err != nil {
			log.Fatal(err)
		}
		if tlsPath != "" {
			readFileToBase64Str := func(filename string) string {
				filepath := path.Join(tlsPath, filename)
				content, err := ioutil.ReadFile(filepath)
				if err != nil {
					log.WithError(err).Fatalf("unable to read from: '%s'", filepath)
				}
				return base64.StdEncoding.EncodeToString(content)
			}
			request.Tls = &api.TlsConfig{
				Ca:  readFileToBase64Str("ca.crt"),
				Crt: readFileToBase64Str("tls.crt"),
				Key: readFileToBase64Str("tls.key"),
			}
		}

		if request.Hints == nil {
			request.Hints = &api.RegistrationHints{}
		}

		cordoned, err := cmd.Flags().GetBool("hint-cordoned")
		if err != nil {
			log.Fatal(err)
		}
		if cmd.Flags().Changed("hint-cordoned") {
			request.Hints.Cordoned = cordoned
		}

		govern, err := cmd.Flags().GetBool("hint-govern")
		if err != nil {
			log.Fatal(err)
		}
		if cmd.Flags().Changed("hint-govern") {
			request.Hints.Govern = govern
		}

		preferability, err := cmd.Flags().GetString("hint-preferability")
		if err != nil {
			log.Fatal(err)
		}

		if cmd.Flags().Changed("hint-preferability") {
			switch preferability {
			case "none":
				request.Hints.Perfereability = api.Preferability_None
			case "prefer":
				request.Hints.Perfereability = api.Preferability_Prefer
			case "dontschedule":
				request.Hints.Perfereability = api.Preferability_DontSchedule
			default:
				log.Fatal("--hint-preferability needs to be one of: 'none', 'prefer', 'dontschedule'")
			}
		}

		_, err = client.Register(ctx, request)
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		fmt.Printf("cluster registered: %v\n", request)
	},
}

func init() {
	clustersRegisterCmd.Flags().String("name", "", "cluster name")
	clustersRegisterCmd.Flags().String("url", "", "cluster url")
	clustersRegisterCmd.Flags().String("tls-path", "", "folder containing the ws cluster's ca.crt, tls.crt and tls.key")
	clustersRegisterCmd.Flags().Bool("hint-cordoned", false, "sets hint cordoned")
	clustersRegisterCmd.Flags().Bool("hint-govern", false, "sets hint govern")
	clustersRegisterCmd.Flags().String("hint-preferability", "none", "sets hint preferability, one of: 'none', 'prefer', 'dontschedule'")

	clustersRegisterCmd.Flags().String("from-file", "", "reads request from JSON file, '-' for stdin")

	clustersCmd.AddCommand(clustersRegisterCmd)
}
