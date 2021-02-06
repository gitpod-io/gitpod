// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package gcp

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"github.com/gitpod-io/installer/pkg/terraform"
	"github.com/gitpod-io/installer/pkg/ui"
	log "github.com/sirupsen/logrus"
	"google.golang.org/api/cloudbilling/v1"
	"google.golang.org/api/cloudresourcemanager/v1"
	"google.golang.org/api/serviceusage/v1"
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

// GenerateProjectNameAndID returns a GCP project name and ID from a given prefix, and branch like so:
//   projectID = (prefix + hex(sha1(branch))[:30]
//   projectName = (prefix + branch)[:30]
// GCP requires projectID to be between 6 and 30 chars and projectName to be between 4 and 30 chars
// It also requires projectID to be unique, and we want projectName to be human readable.
func GenerateProjectNameAndID(prefix, branch string) (string, string) {
	hasher := sha1.New()
	_, _ = hasher.Write([]byte(branch))
	branchHash := hex.EncodeToString(hasher.Sum(nil))

	projectName := fmt.Sprintf("%s%s", prefix, branch)
	if len(projectName) > 30 {
		projectName = projectName[:30]
	}
	projectID := fmt.Sprintf("%s%s", prefix, branchHash)
	if len(projectID) > 30 {
		projectID = projectID[:30]
	}

	return projectID, projectName
}

// ProjectExists attempts to discover if a given projectID exists.
// It may still returns false when the project exists when having permission issue or
// api errors, as there is no reliable way to triage the returned errors.
// an error is only returned when failing to init the resource manager service client
// or when the project exists but isn't in ACTIVE state (ie: pending deletion)
func ProjectExists(ctx context.Context, projectID string) (bool, error) {
	gcpResourceManager, err := cloudresourcemanager.NewService(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to create GCP resource manager: %v", err)
	}
	project, err := gcpResourceManager.Projects.Get(projectID).Context(ctx).Do()
	if err != nil {
		return false, nil
	}

	if project.LifecycleState != "ACTIVE" {
		return false, fmt.Errorf("gcp project %q exists but is not active", projectID)
	}

	return true, nil
}

// CreateGCPProject creates a new project in GCP and enables the billing account on it.
// and wait for the creation to complete before returning.
func CreateProject(ctx context.Context, projectID, projectName, parentFolderID string) error {
	gcpResourceManager, err := cloudresourcemanager.NewService(ctx)
	if err != nil {
		return fmt.Errorf("failed to create GCP resource manager service: %v", err)
	}

	var parentFolder *cloudresourcemanager.ResourceId
	if parentFolderID != "" {
		parentFolder = &cloudresourcemanager.ResourceId{Type: "folder", Id: parentFolderID}
	}

	// https://cloud.google.com/resource-manager/reference/rest/v1/projects/create
	op, err := gcpResourceManager.Projects.Create(&cloudresourcemanager.Project{
		ProjectId: projectID,
		Name:      projectName,
		Parent:    parentFolder,
	}).Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("failed to create project: %v", err)
	}

	// wait for project create operation to complete
	// https://cloud.google.com/resource-manager/reference/rest/Shared.Types/Operation
	// https://cloud.google.com/resource-manager/reference/rest/v1/operations/get
	for !op.Done {
		select {
		case <-ctx.Done():
			return fmt.Errorf("project creation failed: %v", ctx.Err())
		case <-time.After(1 * time.Second):
			op, err = gcpResourceManager.Operations.Get(op.Name).Context(ctx).Do()
			if err != nil {
				return fmt.Errorf("failed to check project creation status: %v", err)
			}
		}
	}

	if op.Error != nil {
		return fmt.Errorf("failed to create project: %v (err code: %d)", op.Error.Message, op.Error.Code)
	}

	return nil
}

func ConfigureProjectBilling(ctx context.Context, projectID, billingAccountID string) error {
	billingService, err := cloudbilling.NewService(ctx)
	if err != nil {
		return fmt.Errorf("failed to create GCP cloud billing service: %v", err)
	}
	project := fmt.Sprintf("projects/%s", projectID)
	accountName := fmt.Sprintf("billingAccounts/%s", billingAccountID)

	infos, err := billingService.Projects.GetBillingInfo(project).Do()
	if err != nil {
		return fmt.Errorf("failed to retrieve project billing info: %v", err)
	}
	if infos.BillingAccountName == accountName {
		// already ok, don't update
		return nil
	}

	_, err = billingService.Projects.UpdateBillingInfo(project, &cloudbilling.ProjectBillingInfo{
		BillingAccountName: accountName,
	}).Do()
	if err != nil {
		return fmt.Errorf("failed to update billing account info: %v", err)
	}
	return nil
}

var DefaultProjectServices = []string{
	"compute.googleapis.com",
}

// EnableProjectServices enable some APIs on project, at least thoses from DefaultProjectServices, more can be provided via services
func EnableProjectServices(ctx context.Context, projectID string, services []string) error {
	serviceUsageService, err := serviceusage.NewService(ctx)
	if err != nil {
		return fmt.Errorf("failed to create GCP service usage service: %v", err)
	}

	allServices := append(DefaultProjectServices, services...)
	batchEnableOp, err := serviceUsageService.Services.BatchEnable(
		fmt.Sprintf("projects/%s", projectID),
		&serviceusage.BatchEnableServicesRequest{
			ServiceIds: allServices,
		},
	).Do()
	if err != nil {
		return fmt.Errorf("failed to activate services %v: %v", allServices, err)
	}
	for !batchEnableOp.Done {
		select {
		case <-ctx.Done():
			return fmt.Errorf("service activation failed: %v", ctx.Err())
		case <-time.After(1 * time.Second):
			batchEnableOp, err = serviceUsageService.Operations.Get(batchEnableOp.Name).Context(ctx).Do()
			if err != nil {
				return fmt.Errorf("failed to check service activation status: %v", err)
			}
		}
	}

	if batchEnableOp.Error != nil {
		return fmt.Errorf(
			"failed to enable services %v: %v (err code: %d)",
			allServices,
			batchEnableOp.Error.Message,
			batchEnableOp.Error.Code,
		)
	}

	return nil
}

func CreateStorageBucket(ctx context.Context, projectID, bucketName string) error {
	storageService, err := storage.NewClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create GCP storage service: %v", err)
	}

	bkt := storageService.Bucket(bucketName)

	if _, err = bkt.Attrs(ctx); err != nil {
		if err != storage.ErrBucketNotExist {
			return err
		}
		if err := bkt.Create(ctx, projectID, &storage.BucketAttrs{
			Location:          "EU",
			VersioningEnabled: true,
			LocationType:      "region",
		}); err != nil {
			return fmt.Errorf("failed to create storage bucket %q: %v", bucketName, err)
		}
	}
	return nil
}
