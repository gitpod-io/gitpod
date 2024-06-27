// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"path"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
)

// clustersUpdateCmd represents the clustersUpdateCmd command
var clustersUpdateCmd = &cobra.Command{
	Use:   "update --name [cluster name]",
	Short: "Update a cluster",
	Args:  cobra.ExactArgs(1),
}

var clustersUpdateScoreCmd = &cobra.Command{
	Use:   "score <value>",
	Short: "Update a cluster's score",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := getClusterName()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		value, err := strconv.Atoi(args[0])
		if err != nil {
			log.Fatal(err)
		}
		request := &api.UpdateRequest{Name: name, Property: &api.UpdateRequest_Score{Score: int32(value)}}

		_, err = client.Update(ctx, request)
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		fmt.Printf("cluster '%s' updated with score=%s\n", name, args[0])
	},
}

var clustersUpdateMaxScoreCmd = &cobra.Command{
	Use:   "max-score <value>",
	Short: "Update a cluster's max score",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := getClusterName()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		value, err := strconv.Atoi(args[0])
		if err != nil {
			log.Fatal(err)
		}
		request := &api.UpdateRequest{Name: name, Property: &api.UpdateRequest_MaxScore{MaxScore: int32(value)}}

		_, err = client.Update(ctx, request)
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		fmt.Printf("cluster '%s' updated with max_score=%s\n", name, args[0])
	},
}

var clustersUpdateAdmissionConstraintCmd = &cobra.Command{
	Use:   "admission-constraint add|remove has-feature-preview|has-permission=<permission>",
	Short: "Updates a cluster's admission constraints",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		name := getClusterName()

		var add bool
		switch args[0] {
		case "add":
			add = true
		case "remove":
			add = false
		default:
			log.Fatalf("must be add or remove instead of \"%s\"", args[0])
		}

		request := &api.UpdateRequest{Name: name}
		if args[1] == "has-feature-preview" {
			request.Property = &api.UpdateRequest_AdmissionConstraint{
				AdmissionConstraint: &api.ModifyAdmissionConstraint{
					Add: add,
					Constraint: &api.AdmissionConstraint{
						Constraint: &api.AdmissionConstraint_HasFeaturePreview{},
					},
				},
			}
		} else if strings.HasPrefix(args[1], "has-permission=") {
			request.Property = &api.UpdateRequest_AdmissionConstraint{
				AdmissionConstraint: &api.ModifyAdmissionConstraint{
					Add: add,
					Constraint: &api.AdmissionConstraint{
						Constraint: &api.AdmissionConstraint_HasPermission_{
							HasPermission: &api.AdmissionConstraint_HasPermission{
								Permission: strings.TrimPrefix(args[1], "has-permission="),
							},
						},
					},
				},
			}
		} else {
			log.Fatalf("unknown constraint: %s", args[1])
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		_, err = client.Update(ctx, request)
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		fmt.Printf("cluster '%s' updated with admission constraint %s\n", name, request.GetAdmissionConstraint())
	},
}

var clustersUpdateTLSConfigCmd = &cobra.Command{
	Use:   "tls",
	Short: "Updates a cluster's TLS configuration",
	Args:  cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		name := getClusterName()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		tlsPath, err := cmd.Flags().GetString("tls-path")
		if err != nil {
			log.Fatal(err)
		}
		if tlsPath == "" {
			log.Fatal("tls-path is required")
		}

		readFileToBase64Str := func(filename string) string {
			filepath := path.Join(tlsPath, filename)
			content, err := ioutil.ReadFile(filepath)
			if err != nil {
				log.WithError(err).Fatalf("unable to read from: '%s'", filepath)
			}
			return base64.StdEncoding.EncodeToString(content)
		}
		request := &api.UpdateRequest{Name: name, Property: &api.UpdateRequest_Tls{Tls: &api.TlsConfig{
			Ca:  readFileToBase64Str("ca.crt"),
			Crt: readFileToBase64Str("tls.crt"),
			Key: readFileToBase64Str("tls.key"),
		}}}

		_, err = client.Update(ctx, request)
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		fmt.Printf("cluster '%s' tls config updated\n", name)
	},
}

func init() {
	clustersCmd.AddCommand(clustersUpdateCmd)
	clustersUpdateCmd.AddCommand(clustersUpdateScoreCmd)
	clustersUpdateCmd.AddCommand(clustersUpdateMaxScoreCmd)
	clustersUpdateCmd.AddCommand(clustersUpdateAdmissionConstraintCmd)
	clustersUpdateTLSConfigCmd.Flags().String("tls-path", "", "folder containing the ws cluster's ca.crt, tls.crt and tls.key")
	clustersUpdateCmd.AddCommand(clustersUpdateTLSConfigCmd)
}
