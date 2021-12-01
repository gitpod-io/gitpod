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
	project    = pflag.StringP("project", "p", "", "name of the Google project - defaults to what's configured in gcloud")
	kubeconfig = pflag.StringP("kubeconfig", "k", os.Getenv("KUBECONFIG"), "kubeconfig filepath")
)

func main() {
	pflag.Parse()

	node := pflag.Arg(0)
	if node == "" {
		logrus.Fatalf("usage: %s [--project|-p GoogleProject] [--kubeconfig|-k ~/.kube/config] <nodeName>", os.Args[0])
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

	serverIP, err := getServerIP(node, prj)
	if err != nil {
		logrus.WithError(err).Fatal("cannot get node IP")
	}

	kubecfg, err := getK3sKubeconfig(node, prj)
	if err != nil {
		logrus.WithError(err).Fatal("cannot get kubeconfig")
	}

	kubecfg = bytes.ReplaceAll(kubecfg, []byte("127.0.0.1"), []byte(serverIP))
	kubecfg = bytes.ReplaceAll(kubecfg, []byte("default"), []byte(node))

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

func getServerIP(nodeName, project string) (sererIP string, err error) {
	var nfo struct {
		NetworkInterfaces []struct {
			AccessConfigs []struct {
				NatIP string `json:"natIP"`
			} `json:"accessConfigs"`
		} `json:"networkInterfaces"`
	}

	out, err := exec.Command("gcloud", "compute", "instances", "describe", "--format=json", "--project", project, nodeName).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to describe node: %s: %w", string(out), err)
	}

	err = json.Unmarshal(out, &nfo)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal node description: %s: %w", string(out), err)
	}

	for _, iff := range nfo.NetworkInterfaces {
		for _, n := range iff.AccessConfigs {
			if n.NatIP == "" {
				continue
			}

			return n.NatIP, nil
		}
	}

	return "", fmt.Errorf("did not find public IP for node")
}

func getK3sKubeconfig(nodeName, project string) ([]byte, error) {
	res, err := exec.Command("gcloud", "compute", "ssh", "--project", project, "--command", "sudo cat /etc/rancher/k3s/k3s.yaml", nodeName).CombinedOutput()
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
