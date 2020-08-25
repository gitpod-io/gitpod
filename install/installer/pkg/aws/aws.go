// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package aws

import (
	"bytes"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/gitpod-io/installer/pkg/terraform"
	"github.com/gitpod-io/installer/pkg/ui"
)

var availableRegions = []string{
	"af-south-1",
	"ap-east-1",
	"ap-northeast-1",
	"ap-northeast-2",
	"ap-northeast-3",
	"ap-south-1",
	"ap-southeast-1",
	"ap-southeast-2",
	"ca-central-1",
	"cn-north-1",
	"cn-northwest-1",
	"eu-central-1",
	"eu-north-1",
	"eu-south-1",
	"eu-west-1",
	"eu-west-2",
	"eu-west-3",
	"me-south-1",
	"sa-east-1",
	"us-east-1",
	"us-east-2",
	"us-gov-east-1",
	"us-gov-west-1",
	"us-west-1",
	"us-west-2",
}

// RequiredTerraformVariables are the variables required to execute the GCP terraform scripts
var RequiredTerraformVariables = []terraform.PersistVariableOpts{
	{
		Name: "region",
		Spec: terraform.VariableSpec{
			Description: "Your target AWS region - see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html for a list of available regions.",
			Validate: func(val string) error {
				val = strings.TrimSpace(val)
				found := false
				for _, region := range availableRegions {
					if val == region {
						found = true
						break
					}
				}
				if !found {
					return fmt.Errorf("%q is not a valid AWS region", val)
				}
				return nil
			},
		},
	},
	{
		Name: "domain",
		Spec: terraform.VariableSpec{
			Description: `Gitpod works best when it's accessible using a Domain, rather than by IP address alone.
Please enter the domain under which you intent to operate Gitpod (e.g. gitpod.your-company.com).
Later, you'll be asked to add a DNS record to connect that domain with Gitpod's IP address.

If you don't have your own (sub-)domain available, leave this field blank and we'll get a temporary one for you.
That domain will work for at least 30 days, but is not meant for productive installations.
You can, at any time move to your own domain by editing aws/main.auto.tfvars and re-running this installer.`,
		},
	},
	{
		Name: "project",
		Sources: []terraform.VariableValueSource{
			func(name string, spec terraform.VariableSpec) (value string, ok bool) {
				return "gp" + fmt.Sprint(rand.Int())[0:10], true
			},
		},
	},
}

// TerraformErrorRetry retries when known AWS issues arrise
func TerraformErrorRetry(unsetVar func(name string)) terraform.RunRetryFunc {
	return func(line []byte) terraform.RetryMethod {
		if bytes.Contains(line, []byte("Invalid value: 31080: provided port is already allocated")) {
			ui.Warnf(`Past experience has shown it takes up to five minutes before NodePorts can be re-alloced.
Now would be a great time for a cup of coffee and we'll retry in five minutes.`)

			for i := 5; i > 0; i++ {
				time.Sleep(60 * time.Second)
				ui.Infof("Waiting another %d minutes.", i)
			}
			return terraform.Retry
		}
		if bytes.Contains(line, []byte("OptInRequired: You are not subscribed to this service.")) {
			ui.Errorf("Your account seems to be missing a credit card. Go to https://portal.aws.amazon.com/billing/signup?type=resubscribe#/resubscribed and finish the subscription process.")
			return terraform.DontRetryAndFail
		}
		if bytes.Contains(line, []byte("The requested configuration is currently not supported")) {
			ui.Errorf("Switch to another AWS region (https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html) often helps.\nSome machines are not available in all regions.")
			unsetVar("region")
			return terraform.DontRetryAndFail
		}

		return terraform.DontRetry
	}
}
