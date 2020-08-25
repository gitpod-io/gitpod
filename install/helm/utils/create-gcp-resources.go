// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

//usr/bin/env go run "$0" "$@"; exit "$?"

package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

var (
	cwd              string
	projectID        string
	region           string
	zone             string
	ipAddress        string
	dbName           string
	dbRootPassword   string
	dbGitpodPassword string
)

func init() {
	var err error
	cwd, err = os.Getwd()
	failOnError(err)
	cwd, err = filepath.Abs(cwd)
	failOnError(err)

	flag.StringVar(&cwd, "cwd", cwd, "working directory")
}

func main() {
	flag.Parse()
	defer fmt.Println()

	fmt.Println("This is the GCP project setup script for Gitpod.")
	fmt.Println("It is re-entrant, meaning that if it fails at any point you should be able to run it again without the script failing before that point.")

	printStep("check environment")
	failOnError(checkEnvironment())

	printStep("create VPC network")
	failOnError(createVPCNetwork())

	printStep("create service accounts")
	failOnError(createServiceAccounts())

	printStep("create cluster (this takes a while)")
	failOnError(createCluster())

	printStep("set up bucket storage")
	failOnError(setupBucketStorage())

	printStep("set up container registry")
	failOnError(setupContainerRegistry())

	printStep("create database (this takes a while)")
	failOnError(createDatabase())

	printStep("initialize database")
	failOnError(initializeDatabase())

	printStep("setup helm")
	failOnError(setupHelm())

	printStep("create static IP address")
	failOnError(createIPAddress())

	printNextSteps()
}

func checkEnvironment() error {
	// make sure required tools are installed
	requiredTools := map[string]string{
		"gcloud": "Google Cloud SDK is not installed - head over to https://cloud.google.com/sdk/install and install it",
		"mysql":  "MySQL client is not installed - make sure `mysql` is available in the PATH",
		"wget":   "wget is required but not available",
	}
	for cmd, errmsg := range requiredTools {
		if _, err := exec.LookPath(cmd); err != nil {
			return fmt.Errorf(errmsg)
		}
	}

	// make sure we're logged in
	out, _ := run("gcloud", "auth", "list")
	if strings.Contains(out, "No credentialed accounts") {
		runLoud("gcloud", "auth", "login")
	}

	// install the gcloud beta components required for this setup
	failOnError(runLoud("gcloud", "components", "install", "beta"))

	// ensure gcloud is configured properly and extract that config
	configSettings := []struct {
		V       *string
		GCPName string
		Name    string
		Link    string
	}{
		{&projectID, "core/project", "project", ""},
		{&region, "compute/region", "compute region", "https://cloud.google.com/compute/docs/regions-zones/"},
		{&zone, "compute/zone", "compute zone", "https://cloud.google.com/compute/docs/regions-zones/"},
	}
	for _, v := range configSettings {
		out, err := run("gcloud", "config", "get-value", v.GCPName)
		if err != nil {
			return fmt.Errorf(errPrjNotConfigured)
		}

		val := strings.TrimSpace(string(out))
		if strings.Contains(val, "(unset)") {
			var desc string
			if v.Link != "" {
				desc = " (see " + v.Link + ")"
			}
			fmt.Printf("\n  \033[36mNo %s configured. \033[mPlease enter the %s%s:\n  > ", v.GCPName, v.Name, desc)
			fmt.Scanln(&val)

			val = strings.TrimSpace(val)
			if val == "" {
				return fmt.Errorf(errPrjNotConfigured)
			}

			out, err := run("gcloud", "config", "set", v.GCPName, val)
			if err != nil {
				return fmt.Errorf(out)
			}
		}

		*v.V = val
		fmt.Printf("  %s: %s\n", v.GCPName, val)
	}

	var choice string
	fmt.Print("\n\033[32mBeware: \033[mthis script is about to create resources in your GCP project that will cost you money.\nDo you want to continue? [Y/n] ")
	fmt.Scanln(&choice)
	if !(choice == "" || choice == "y" || choice == "Y") {
		return fmt.Errorf("aborting")
	}

	out, err := run("gcloud", "projects", "describe", projectID)
	if err != nil {
		fmt.Print("\n\033[33mProject could not be accessed. \033[mCould not access project. It may not exist (or you do not have the permissions). Do you want to try to create the project? [Y/n] ")
		fmt.Scanln(&choice)
		if !(choice == "" || choice == "y" || choice == "Y") {
			return fmt.Errorf(string(out))
		}
		failOnError(runLoud("gcloud", "projects", "create", projectID))
	}

	requiredServices := []string{
		"compute.googleapis.com",
		"iam.googleapis.com",
		"container.googleapis.com",
		"sqladmin.googleapis.com",
	}
	for _, s := range requiredServices {
		out, err := run("gcloud", "services", "enable", s)
		if err != nil && strings.Contains(string(out), "Billing") {
			return fmt.Errorf("billing must be enabled for this project\n  head over to https://console.cloud.google.com/billing/linkedaccount?project=" + projectID + "&folder&organizationId to set it up")
		}
		if err != nil {
			return fmt.Errorf(string(out))
		}
	}

	return nil
}

func createIPAddress() error {
	ipAddrName := "gitpod-inbound-ip"

	// create IP
	_, err := run("gcloud", "compute", "addresses", "create", ipAddrName, "--region="+region)
	if err != nil && !isAlreadyExistsErr(err) {
		return err
	}

	// find out which IP we've just created
	out, err := run("gcloud", "compute", "addresses", "describe", ipAddrName, "--region="+region)
	if err != nil {
		return err
	}
	for _, line := range strings.Split(string(out), "\n") {
		p := "address: "
		if !strings.HasPrefix(line, p) {
			continue
		}
		ipAddress = strings.TrimSpace(strings.TrimPrefix(line, p))
	}
	if ipAddress == "" {
		return fmt.Errorf("unable to get IP address we just created")
	}

	// try and find configured hostname - if that fails default to your-domain.com
	var domain string
	fc, err := ioutil.ReadFile(filepath.Join(cwd, "values.yaml"))
	if err != nil {
		return fmt.Errorf("cannot set load balancer IP: %v", err)
	}
	lines := strings.Split(string(fc), "\n")
	for i, l := range lines {
		if strings.Contains(l, "hostname: ") {
			segs := strings.Split(l, "hostname: ")
			segs = strings.Fields(segs[1])
			domain = segs[0]
			continue
		}
		if strings.Contains(l, "loadBalancerIP:") {
			segs := strings.Split(l, ":")
			lines[i] = segs[0] + ": " + ipAddress
		}
	}
	err = ioutil.WriteFile(filepath.Join(cwd, "values.yaml"), []byte(strings.Join(lines, "\n")), 0644)
	if err != nil {
		return fmt.Errorf("cannot write values.yaml: %v", err)
	}

	fmt.Printf("  IP address: %s\n", ipAddress)
	fmt.Println("\n\033[36mManual step: \033[m" + `Please set up the following DNS entries for your domain
	` + domain + `         ` + ipAddress + `
	*.` + domain + `       ` + ipAddress + `
	*.ws.` + domain + `    ` + ipAddress + `

  You don't have to do this right away; this installation script does not depend on it.
  Your installation will not be complete before you have set up those DNS entries, however.

  Press [RETURN] to continue.
`)
	var ignoredInput string
	fmt.Scanln(&ignoredInput)

	return nil
}

func createVPCNetwork() error {
	out, err := run("gcloud", "compute", "networks", "create", "gitpod-vpc", "--bgp-routing-mode=regional", "--subnet-mode=auto")
	if err != nil && !strings.Contains(string(out), "already exists") {
		return err
	}
	return nil
}

func createServiceAccounts() error {
	serviceAccounts := []string{
		"gitpod-nodes-meta",
		"gitpod-nodes-workspace",
	}
	roles := []string{
		"roles/clouddebugger.agent",
		"roles/cloudtrace.agent",
		"roles/errorreporting.writer",
		"roles/logging.viewer",
		"roles/logging.logWriter",
		"roles/monitoring.metricWriter",
		"roles/monitoring.viewer",
	}

	for _, sa := range serviceAccounts {
		// create service account - don't fail if it exists already
		_, err := run("gcloud", "iam", "service-accounts", "create", sa)
		if err != nil && !isAlreadyExistsErr(err) {
			return err
		}

		// assign all roles to service account
		for _, role := range roles {
			out, err := run("gcloud", "projects", "add-iam-policy-binding", projectID, "--member=serviceAccount:gitpod-nodes-meta@"+projectID+".iam.gserviceaccount.com", "--role="+role)
			if err != nil {
				return fmt.Errorf("%v\n%s", err, string(out))
			}
		}
	}

	return nil
}

func findAvailableGKEVersion() (version string, err error) {
	out, err := run("gcloud", "container", "get-server-config", "--zone="+zone, "--format=json")
	if err != nil {
		return
	}
	// trim first line which reads something like "Fetching server config for ...", hence is not valid JSON
	out = strings.Join(strings.Split(out, "\n")[1:], "\n")

	var info struct {
		DefaultClusterVersion string   `json:"defaultClusterVersion"`
		ValidImageTypes       []string `json:"validImageTypes"`
	}
	err = json.Unmarshal([]byte(out), &info)
	if err != nil {
		return
	}

	// while we're at it we'll make sure we have cos_containerd available
	var found bool
	for _, tpe := range info.ValidImageTypes {
		if tpe == "COS_CONTAINERD" {
			found = true
			break
		}
	}
	if !found {
		return "", fmt.Errorf("zone does not support cos_containerd GKE nodes: please use a different zone")
	}

	return info.DefaultClusterVersion, nil
}

func createCluster() error {
	version, err := findAvailableGKEVersion()
	if err != nil {
		return err
	}

	metapoolArgs := map[string]string{
		"region":                      region,
		"node-locations":              zone,
		"cluster-version":             version,
		"addons=NetworkPolicy":        "",
		"no-enable-basic-auth":        "",
		"no-issue-client-certificate": "",
		"enable-ip-alias":             "",
		"cluster-ipv4-cidr":           "10.8.0.0/14",
		"services-ipv4-cidr":          "10.0.0.0/20",
		"network=gitpod-vpc":          "",
		"enable-network-policy":       "",
		"enable-pod-security-policy":  "",
		"metadata":                    "disable-legacy-endpoints=true",
		"num-nodes":                   "1",
		"enable-autoscaling":          "",
		"min-nodes":                   "1",
		"max-nodes":                   "3",
		"service-account":             "gitpod-nodes-meta@" + projectID + ".iam.gserviceaccount.com",
		"node-labels":                 "gitpod.io/workload_meta=true",
		"machine-type":                "n1-standard-4",
		"image-type":                  "cos",
		"disk-size":                   "100",
		"disk-type":                   "pd-ssd",
		"enable-autorepair":           "",
		"local-ssd-count":             "0",
		"workload-metadata-from-node": "SECURE",
		"no-enable-autoupgrade":       "",
	}
	_, err = run("gcloud", buildArgs([]string{"beta", "container", "clusters", "create", "gitpod-cluster"}, metapoolArgs)...)
	if err != nil && !isAlreadyExistsErr(err) {
		return err
	}

	wspoolArgs := map[string]string{
		"region":                region,
		"cluster":               "gitpod-cluster",
		"metadata":              "disable-legacy-endpoints=true",
		"num-nodes":             "0",
		"enable-autoscaling":    "",
		"min-nodes":             "0",
		"max-nodes":             "10",
		"service-account":       "gitpod-nodes-workspace@" + projectID + ".iam.gserviceaccount.com",
		"node-labels":           "gitpod.io/workload_workspace=true",
		"machine-type":          "n1-standard-16",
		"image-type":            "cos_containerd",
		"disk-size":             "200",
		"disk-type":             "pd-ssd",
		"enable-autorepair":     "",
		"local-ssd-count":       "1",
		"no-enable-autoupgrade": "",
	}
	_, err = run("gcloud", buildArgs([]string{"beta", "container", "node-pools", "create", "workspace-pool-1"}, wspoolArgs)...)
	if err != nil && !isAlreadyExistsErr(err) {
		return err
	}

	return nil
}

func setupBucketStorage() error {
	_, err := run("gcloud", "iam", "service-accounts", "create", "gitpod-workspace-syncer")
	if err != nil && !isAlreadyExistsErr(err) {
		return err
	}
	_, err = run("gcloud", "projects", "add-iam-policy-binding", projectID, "--member=serviceAccount:gitpod-workspace-syncer@"+projectID+".iam.gserviceaccount.com", "--role=roles/storage.admin")
	if err != nil {
		return err
	}
	_, err = run("gcloud", "projects", "add-iam-policy-binding", projectID, "--member=serviceAccount:gitpod-workspace-syncer@"+projectID+".iam.gserviceaccount.com", "--role=roles/storage.objectAdmin")
	if err != nil {
		return err
	}
	_, err = run("gcloud", "projects", "add-iam-policy-binding", projectID, "--member=serviceAccount:gitpod-workspace-syncer@"+projectID+".iam.gserviceaccount.com", "--role=roles/storage.objectViewer")
	if err != nil {
		return err
	}
	_, err = run("gcloud", "iam", "service-accounts", "keys", "create", "secrets/gitpod-workspace-syncer-key.json", "--iam-account=gitpod-workspace-syncer@"+projectID+".iam.gserviceaccount.com")
	if err != nil {
		return err
	}

	// write bucket config yaml file
	bucketsYamlFN := filepath.Join(cwd, "values", "gcp", "buckets.yaml")
	fc, err := ioutil.ReadFile(bucketsYamlFN)
	if err != nil {
		return err
	}
	fc = bytes.ReplaceAll(fc, []byte("some-gcp-project-id"), []byte(projectID))
	fc = bytes.ReplaceAll(fc, []byte("some-gcp-region"), []byte(region))
	err = ioutil.WriteFile(bucketsYamlFN, fc, 0644)
	if err != nil {
		return err
	}

	return nil
}

func setupContainerRegistry() error {
	_, err := run("gcloud", "iam", "service-accounts", "create", "gitpod-registry-full")
	if err != nil && !isAlreadyExistsErr(err) {
		return err
	}

	_, err = run("gcloud", "projects", "add-iam-policy-binding", projectID, "--member=serviceAccount:gitpod-registry-full@"+projectID+".iam.gserviceaccount.com", "--role=roles/storage.admin")
	if err != nil {
		return err
	}
	_, err = run("gcloud", "iam", "service-accounts", "keys", "create", "secrets/gitpod-registry-full-key.json", "--iam-account=gitpod-registry-full@"+projectID+".iam.gserviceaccount.com")
	if err != nil {
		return err
	}

	sakey, err := ioutil.ReadFile(filepath.Join(cwd, "secrets", "gitpod-registry-full-key.json"))
	if err != nil {
		return err
	}

	auth := base64.StdEncoding.EncodeToString(append([]byte("_json_key:"), sakey...))
	ioutil.WriteFile(filepath.Join(cwd, "secrets", "registry-auth.json"), []byte(`
{
	"auths": {
		"gcr.io": {
			"auth": "`+auth+`"
		}
	}
}	
`), 0644)

	err = ioutil.WriteFile(filepath.Join(cwd, "values", "registry.yaml"), []byte(`
gitpod:
  components:
    imageBuilder:
      registryCerts: []
      registry:
        # name must not end with a "/"
        name: gcr.io/`+projectID+`
        secretName: image-builder-registry-secret
        path: secrets/registry-auth.json

    workspace:
      pullSecret:
        secretName: image-builder-registry-secret

  docker-registry:
    enabled: false

gitpod_selfhosted:
  variants:
    customRegistry: true
`), 0644)
	if err != nil {
		return err
	}

	return nil
}

func createDatabase() error {
	dbName = "gitpod-db"

	dbRootPassword = generateRandomPassword()
	fmt.Printf("  root database user password: %s\n", dbRootPassword)

	args := map[string]string{
		"database-version":      "MYSQL_5_7",
		"storage-size":          "100",
		"storage-auto-increase": "",
		"tier":                  "db-n1-standard-4",
		"region":                region,
		"backup-start-time":     "04:00",
		"failover-replica-name": dbName + "-failover",
		"replica-type":          "FAILOVER",
		"enable-bin-log":        "",
	}
	_, err := run("gcloud", buildArgs([]string{"sql", "instances", "create", dbName}, args)...)
	if err != nil && !isAlreadyExistsErr(err) {
		return err
	}

	var pwdSet bool
	for i := 0; i < 5; i++ {
		out, err := run("gcloud", "sql", "users", "set-password", "root", "--host", "%", "--instance", dbName, "--password", dbRootPassword)
		if err != nil && strings.Contains(string(out), "HTTPError 409") {
			var waittime = (i + 1) * 15
			fmt.Printf("  unable to set password - retrying in %d seconds\n  \033[2m%s\033[m\n", waittime, string(out))
			time.Sleep(time.Duration(waittime) * time.Second)
			continue
		}
		if err != nil {
			return err
		}

		pwdSet = true
		break
	}
	if !pwdSet {
		return fmt.Errorf("unable to database password")
	}

	_, err = run("gcloud", "iam", "service-accounts", "create", "gitpod-cloudsql-client")
	if err != nil && !isAlreadyExistsErr(err) {
		return err
	}
	_, err = run("gcloud", "projects", "add-iam-policy-binding", projectID, "--member=serviceAccount:gitpod-cloudsql-client@"+projectID+".iam.gserviceaccount.com", "--role=roles/cloudsql.client")
	if err != nil {
		return err
	}
	_, err = run("gcloud", "iam", "service-accounts", "keys", "create", "secrets/gitpod-cloudsql-client-key.json", "--iam-account=gitpod-cloudsql-client@"+projectID+".iam.gserviceaccount.com")
	if err != nil {
		return err
	}

	return nil
}

func initializeDatabase() error {
	// make sure the cloudSQLProxy is available
	cloudSQLProxy := filepath.Join(cwd, "utils", "cloud_sql_proxy")
	if _, err := os.Stat(cloudSQLProxy); os.IsNotExist(err) {
		failOnError(runLoud("wget", "https://dl.google.com/cloudsql/cloud_sql_proxy."+runtime.GOOS+"."+runtime.GOARCH, "-O", cloudSQLProxy))
		failOnError(runLoud("chmod", "+x", cloudSQLProxy))
	}

	dbGitpodPassword = generateRandomPassword()
	fmt.Printf("  gitpod database user password: %s\n", dbGitpodPassword)

	// create DB init script
	initScript := []byte(`
set @gitpodDbPassword = "` + dbGitpodPassword + `";

source database/01-create-user.sql
source database/02-create-and-init-sessions-db.sql
source database/03-recreate-gitpod-db.sql

ALTER USER "gitpod"@"%" IDENTIFIED BY '` + dbGitpodPassword + `';
FLUSH PRIVILEGES;
    `)

	// start cloudSqlProxy
	cloudSQLProxyCmd := runC(cloudSQLProxy, "-instances="+projectID+":"+region+":"+dbName+"=tcp:0.0.0.0:3306", "-credential_file=secrets/gitpod-cloudsql-client-key.json")
	cloudSQLProxyCmd.Stderr = os.Stderr
	var sqlProxyMayFail bool
	go func() {
		err := cloudSQLProxyCmd.Start()
		if sqlProxyMayFail {
			return
		}
		failOnError(err)
	}()
	defer func() {
		sqlProxyMayFail = true
		cloudSQLProxyCmd.Process.Kill()
	}()

	// wait for some time to give the cloud_sql_proxy some time to start up
	time.Sleep(5 * time.Second)

	// run mysql to initialize the database
	mysqlCmd := runC("mysql", "-u", "root", "-P", "3306", "-h", "127.0.0.1", "-p"+dbRootPassword)
	mysqlCmd.Stdin = bytes.NewReader(initScript)
	out, err := mysqlCmd.CombinedOutput()
	if err != nil {
		if len(out) > 0 {
			return fmt.Errorf(string(out))
		}

		return err
	}

	// write datbase yaml file
	err = ioutil.WriteFile(filepath.Join(cwd, "values", "gcp", "database.yaml"), []byte(`
gitpod:
  db:
    password: "`+dbGitpodPassword+`"

  components:
    db:
	  gcloudSqlProxy:
	  	enabled: true
        instance: `+projectID+":"+region+":"+dbName+`
		credentials: secrets/gitpod-cloudsql-client-key.json
  
  mysql:
    enabled: false
`), 0644)
	if err != nil {
		return err
	}

	return nil
}

func setupHelm() error {
	valueFiles := []string{
		"values.yaml",
		"values/gcp/database.yaml",
		"values/gcp/buckets.yaml",
		"values/registry.yaml",
		"values/node-affinity.yaml",
		"values/node-layout.yaml",
		"values/workspace-sizing.yaml",
	}
	err := ioutil.WriteFile(filepath.Join(cwd, "configuration.txt"), []byte(strings.Join(valueFiles, "\n")+"\n"), 0644)
	if err != nil {
		return err
	}

	_, err = run("gcloud", "container", "clusters", "get-credentials", "--region", region, "gitpod-cluster")
	if err != nil {
		return err
	}
	helmfn := filepath.Join(cwd, "utils", "helm")
	if _, err := os.Stat(helmfn); os.IsNotExist(err) {
		tgtdir := filepath.Join(cwd, runtime.GOOS+"-"+runtime.GOARCH)

		failOnError(runLoud("sh", "-c", "wget -O- https://get.helm.sh/helm-v3.0.1-"+runtime.GOOS+"-"+runtime.GOARCH+".tar.gz | tar xz"))
		failOnError(runLoud("mv", filepath.Join(tgtdir, "helm"), helmfn))
		err = os.RemoveAll(tgtdir)
		if err != nil {
			return err
		}
	}
	return nil
}

func printNextSteps() {
	fmt.Println("\n\n\033[32mCongratulations.\033[m" + `

Your GCP project and this Helm chart are (almost) ready for installation.
The steps left to do are:
- [optional] set up HTTPs certificates (see https://www.gitpod.io/docs/self-hosted/latest/install/https-certs/)
- [required] set your domain (see values.yaml)
- [required] set up OAuth (see https://www.gitpod.io/docs/self-hosted/latest/install/oauth/) (see values.yaml)
- use helm to install Gitpod:

    export PATH=` + filepath.Join(cwd, "utils") + `:$PATH
    helm repo add charts.gitpod.io https://charts.gitpod.io
    helm dep update
    helm upgrade --install $(for i in $(cat configuration.txt); do echo -e "-f $i"; done) gitpod .
`)
}

const (
	// error printed when gcloud isn't configured properly
	errPrjNotConfigured = `GCP project unconfigured. Use 
	gcloud config set core/project <gcloud-project>
	gcloud config set compute/region <gcloud-region>
	gcloud config set compute/zone <gcloud-zone>

to set up your environment.
`
)

// printStep prints a script step in a fancy dressing
func printStep(m string) {
	fmt.Printf("\n\033[33m- %s\033[m\n", m)
}

// failOnError fails this script if an error occured
func failOnError(err error) {
	if err == nil {
		return
	}

	fmt.Fprintf(os.Stderr, "\n\n\033[31mfailure:\033[m %v\n", err)
	os.Exit(1)
}

// isAlreadyExistsErr returns true if the error was produced because a gcloud resource already exists
func isAlreadyExistsErr(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "already exists")
}

// run executes a command end returns its output
func run(command string, args ...string) (output string, err error) {
	cmd := runC(command, args...)
	buf, err := cmd.CombinedOutput()
	if err != nil && strings.Contains(err.Error(), "exit status") {
		return string(buf), fmt.Errorf(string(buf))
	}

	return string(buf), err
}

// run executes a command and forwards the output to stdout/stderr
func runLoud(command string, args ...string) error {
	cmd := runC(command, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

// runC prepares the execution of a command
func runC(command string, args ...string) *exec.Cmd {
	fmt.Printf("  \033[2mrunning: %s %s\033[m\n", command, strings.Join(args, " "))
	cmd := exec.Command(command, args...)
	cmd.Dir = cwd
	cmd.Env = os.Environ()
	return cmd
}

// buildArgs turns a map into arguments in the format gcloud expects
func buildArgs(prefix []string, argm map[string]string) []string {
	var args []string
	args = append(args, prefix...)
	for k, v := range argm {
		if v == "" {
			args = append(args, fmt.Sprintf("--%s", k))
			continue
		}

		args = append(args, fmt.Sprintf("--%s=%s", k, v))
	}
	return args
}

func generateRandomPassword() string {
	const charset = "abcdefghijklmnopqrstuvwxyz" +
		"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	var password string

	rand.Seed(time.Now().UnixNano())
	for i := 0; i < 40; i++ {
		p := charset[rand.Intn(len(charset))]
		password += string(p)
	}
	return password
}
