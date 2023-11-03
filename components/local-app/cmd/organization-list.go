// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/spf13/cobra"
)

var orgListOutputField string

// listOrganizationCommand lists all available organizations
var listOrganizationCommand = &cobra.Command{
	Use:   "list",
	Short: "Lists organizations",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		gitpod, err := getGitpodClient(ctx)
		if err != nil {
			return err
		}

		orgs, err := gitpod.Teams.ListTeams(ctx, connect.NewRequest(&v1.ListTeamsRequest{}))
		if err != nil {
			return err
		}

		orgData := orgs.Msg.GetTeams()

		if orgListOutputField != "" {
			orgListOutputField = common.CapitalizeFirst(orgListOutputField)
			for _, org := range orgData {
				val := reflect.ValueOf(org).Elem()
				if fieldVal := val.FieldByName(orgListOutputField); fieldVal.IsValid() {
					fmt.Printf("%v\n", fieldVal.Interface())
				} else {
					return fmt.Errorf("Field '%s' is an invalid field for organizations", orgListOutputField)
				}
			}
			return nil
		}

		outputOrgs(orgData)

		return nil
	},
}

func init() {
	orgCmd.AddCommand(listOrganizationCommand)
	listOrganizationCommand.Flags().StringVarP(&orgListOutputField, "field", "f", "", "output a specific field of the organizations")
}
