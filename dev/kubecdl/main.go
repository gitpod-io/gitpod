// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/sirupsen/logrus"
	"github.com/spf13/pflag"
)

var (
	project    = pflag.StringP("project", "p", "workspace-clusters", "name of the Google project - defaults to what's configured in gcloud")
	kubeconfig = pflag.StringP("kubeconfig", "k", os.Getenv("KUBECONFIG"), "kubeconfig filepath")
)

func main() {
	pflag.Parse()

	clusterName := pflag.Arg(0)
	if clusterName == "" {
		logrus.Fatalf("usage: %s [--project|-p GoogleProject] [--kubeconfig|-k ~/.kube/config] <clusterName>", os.Args[0])
	}

	_, err := exec.LookPath("gcloud")
	if err != nil {
		logrus.WithError(err).Fatal("gcloud is not available")
	}

	prj := *project
	if prj == "" {
		out, err := exec.Command("gcloud", "config", "get-value", "project").CombinedOutput()
		if err != nil {
			logrus.WithError(err).Fatal("cannot get configured project. Use --project to explicitly set one.")
		}
		prj = strings.TrimSpace(string(out))
	}
	kubecfgfn := *kubeconfig
	if kubecfgfn == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			logrus.Fatal(err)
		}
		kubecfgfn = filepath.Join(home, ".kube", "config")
	}

	serverIP, err := getServerIP(clusterName, prj)
	if err != nil {
		logrus.WithError(err).Fatal("cannot get cluster IP")
	}
	nodeName, zone, err := getNodeName(clusterName, prj)
	if err != nil {
		logrus.WithError(err).Fatal("cannot get node name")
	}
	kubecfg, err := getK3sKubeconfig(nodeName, zone, prj)
	if err != nil {
		logrus.WithError(err).Fatal("cannot get kubeconfig")
	}

	kubecfg = bytes.ReplaceAll(kubecfg, []byte("127.0.0.1"), []byte(serverIP))
	kubecfg = bytes.ReplaceAll(kubecfg, []byte("default"), []byte(clusterName))

	tmpfile, err := os.CreateTemp("", "kubecfg-*.yaml")
	if err != nil {
		logrus.Fatal(err)
	}
	_, err = tmpfile.Write(kubecfg)
	if err != nil {
		logrus.WithError(err).Fatal("cannot write temporary kubeconfig")
	}
	tmpfile.Close()
	defer os.Remove(tmpfile.Name())

	cmd := exec.Command("kubectl", "config", "view", "--flatten", "--merge")
	cmd.Env = append(os.Environ(), fmt.Sprintf("KUBECONFIG=%s:%s", kubecfgfn, tmpfile.Name()))
	res, err := cmd.CombinedOutput()
	if err != nil {
		logrus.WithError(err).Error("cannot merge kubeconfig")
		return
	}

	err = ioutil.WriteFile(kubecfgfn, res, 0644)
	if err != nil {
		logrus.WithError(err).WithField("path", kubecfgfn).Error("cannot write kubeconfig. Dumping combined result:")
		fmt.Println(string(res))
		return
	}
}

func getServerIP(clusterName, project string) (sererIP string, err error) {
	var nfo []struct {
		IPAddress string
		Name      string `json:"name"`
	}

	out, err := exec.Command("gcloud", "compute", "forwarding-rules", "list", "--format=json", "--project", project).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to describe loadbalance: %s: %w", string(out), err)
	}

	err = json.Unmarshal(out, &nfo)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal loadbalance description: %s: %w", string(out), err)
	}
	expectName := "server-ws-" + clusterName
	for _, lb := range nfo {
		if lb.Name == expectName {
			return lb.IPAddress, nil
		}
	}

	return "", fmt.Errorf("did not find public IP for cluster")
}

func getNodeName(clusterName, project string) (nodeName, zone string, err error) {
	var nfo []struct {
		Name string `json:"name"`
		Zone string `json:"zone"`
	}

	out, err := exec.Command("gcloud", "compute", "instances", "list", "--format=json", "--quiet", "--project", project, "--filter", "labels.cluster-name>=ws-"+clusterName+" AND labels.cluster-name<=ws-"+clusterName+" AND labels.instance-type>=control-plane AND labels.instance-type<=control-plane").CombinedOutput()
	if err != nil {
		return "", "", fmt.Errorf("failed to describe node instances: %s: %w", string(out), err)
	}

	err = json.Unmarshal(out, &nfo)
	if err != nil {
		return "", "", fmt.Errorf("failed to unmarshal node instances: %s: %w", string(out), err)
	}
	if len(nfo) > 0 {
		z := strings.Split(nfo[0].Zone, "/")

		return nfo[0].Name, z[len(z)-1], nil
	}
	return "", "", fmt.Errorf("did not find node for cluster")
}

func getK3sKubeconfig(nodeName, zone, project string) ([]byte, error) {
	res, err := exec.Command("gcloud", "compute", "ssh", "--project", project, "--zone", zone, "--command", "sudo cat /etc/rancher/k3s/k3s.yaml", nodeName, "--ssh-flag=-p 2222").CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("cannot ssh into node: %s: %w", string(res), err)
	}

	// we may have had to login first, i.e. the output might not be the pure kubeconfig file
	idx := bytes.Index(res, []byte("apiVersion:"))
	if idx == -1 {
		return nil, fmt.Errorf("did not find kubeconfig")
	}

	return res[idx:], nil
}
