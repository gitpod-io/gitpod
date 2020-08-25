// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package gcp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gitpod-io/installer/pkg/terraform"
	"github.com/gitpod-io/installer/pkg/ui"
	log "github.com/sirupsen/logrus"
)

var availableRegions = []string{
	"asia-east1",
	"asia-east2",
	"asia-northeast1",
	"asia-northeast2",
	"asia-northeast3",
	"asia-south1",
	"asia-southeast1",
	"asia-southeast2",
	"australia-southeast1",
	"europe-north1",
	"europe-west1",
	"europe-west2",
	"europe-west3",
	"europe-west4",
	"europe-west6",
	"northamerica-northeast1",
	"southamerica-east1",
	"us-central1",
	"us-east1",
	"us-east4",
	"us-west1",
	"us-west2",
	"us-west3",
	"us-west4",
}

// RequiredTerraformVariables are the variables required to execute the GCP terraform scripts
var RequiredTerraformVariables = []terraform.PersistVariableOpts{
	{
		Name: "project",
		Spec: terraform.VariableSpec{
			Description: "Project ID (not name) of the GCP project you want to install Gitpod in.",
			Validate: func(val string) error {
				if val == "" {
					return fmt.Errorf("project ID is required")
				}
				return nil
			},
		},
	},
	{
		Name: "region",
		Spec: terraform.VariableSpec{
			Description: "Your target GCP region - see https://cloud.google.com/compute/docs/regions-zones#locations for a list of available regions.",
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
					return fmt.Errorf("%q is not a valid GCP region", val)
				}
				return nil
			},
		},
		Sources: []terraform.VariableValueSource{findBestGCPRegion},
	},
	{
		Name: "domain",
		Spec: terraform.VariableSpec{
			Description: `Gitpod works best when it's accessible using a Domain, rather than by IP address alone.
Please enter the domain under which you intent to operate Gitpod (e.g. gitpod.your-company.com).
Later, you'll be asked to add a DNS record to connect that domain with Gitpod's IP address.

If you don't have your own (sub-)domain available, leave this field blank and we'll get a temporary one for you.
That domain will work for at least 30 days, but is not meant for productive installations.
You can, at any time move to your own domain by editing gcp/main.auto.tfvars and re-running this installer.`,
		},
	},
}

func findBestGCPRegion(name string, spec terraform.VariableSpec) (value string, ok bool) {
	return "", false
}

// EnsureLoggedIn makes sure we are logged into gcloud
func EnsureLoggedIn() error {
	acc, err := getActiveAccount()
	if err != nil {
		return nil
	}

	if acc == "" {
		loginCmdArgs := []string{"auth", "login"}
		log.WithField("command", "gcloud").WithField("args", loginCmdArgs).Debug("running command")
		loginCmd := exec.Command("gcloud", loginCmdArgs...)
		loginCmd.Stdin = os.Stdin
		loginCmd.Stdout = os.Stdout
		loginCmd.Stderr = os.Stderr
		err = loginCmd.Run()
		if err != nil {
			return fmt.Errorf("cannot call \"gcloud %v\": %w", loginCmdArgs, err)
		}
	}

	home, err := os.UserHomeDir()
	if err != nil {
		home = os.Getenv("HOME")
	}
	appDefAccFN := filepath.Join(home, ".config", "gcloud", "application_default_credentials.json")
	if _, err := os.Stat(appDefAccFN); err == nil {
		// default application credentials exist - we're ok
		return nil
	}

	// application default credentials aren't set yet - use the active account to log in
	err = tryAndSetADCFromActiveAccount(appDefAccFN, home)
	if err != nil {
		log.WithError(err).Debug("cannot take over active account credentials - will try default login")

		log.Info("Terraform also the needs GCloud application default credentials. Please login (again) below.")
		loginCmdArgs := []string{"auth", "application-default", "login"}
		log.WithField("command", "gcloud").WithField("args", loginCmdArgs).Debug("running command")
		loginCmd := exec.Command("gcloud", loginCmdArgs...)
		loginCmd.Stdin = os.Stdin
		loginCmd.Stdout = os.Stdout
		loginCmd.Stderr = os.Stderr
		err = loginCmd.Run()
		if err != nil {
			return fmt.Errorf("cannot call \"gcloud %v\": %w", loginCmdArgs, err)
		}
	}

	return nil
}

func tryAndSetADCFromActiveAccount(appDefAccFN, home string) error {
	acc, err := getActiveAccount()
	if err != nil {
		return nil
	}
	if _, err := os.Stat(filepath.Dir(appDefAccFN)); err != nil {
		return fmt.Errorf("cannot determine home for the gcloud application default credentials: %w", err)
	}
	fc, err := ioutil.ReadFile(filepath.Join(home, ".config", "gcloud", "legacy_credentials", acc, "adc.json"))
	if err != nil {
		return fmt.Errorf("cannot read active account credentials: %w", err)
	}
	err = ioutil.WriteFile(appDefAccFN, fc, 0644)
	if err != nil {
		return fmt.Errorf("cannot write application default credentials: %w", err)
	}

	return nil
}

func run(name string, args ...string) ([]byte, error) {
	log.WithField("command", name).WithField("args", args).Debug("running command")
	out, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("cannot call \"%s %v\": %w: %s", name, args, err, string(out))
	}
	return out, nil
}

func getActiveAccount() (string, error) {
	out, err := run("gcloud", "auth", "list", "--format", "json")
	if err != nil {
		return "", err
	}
	var accs []struct {
		Account string `json:"account"`
		Status  string `json:"status"`
	}
	err = json.Unmarshal(out, &accs)
	if err != nil {
		return "", err
	}

	for _, acc := range accs {
		if acc.Status == "ACTIVE" {
			return acc.Account, nil
		}
	}

	return "", nil
}

// BackendErrorRetry enables auto-retry for GCP-caused failures
func BackendErrorRetry(projectID string) terraform.RunRetryFunc {
	return func(line []byte) terraform.RetryMethod {
		if bytes.Contains(line, []byte("googleapi: Error 500: Internal error")) {
			ui.Warnf("Past experience has shown that enabling the compute API using terraform is not always enough to make things work.\n" +
				"Please visit https://console.cloud.google.com/kubernetes/list?organizationId=&project=" + projectID + " which can help move things along.")
			return terraform.Retry
		}

		return terraform.DontRetry
	}
}
