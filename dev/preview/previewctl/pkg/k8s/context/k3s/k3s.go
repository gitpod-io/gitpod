// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k3s

import (
	"bytes"
	"context"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/ssh"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	kctx "github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context"
	pssh "github.com/gitpod-io/gitpod/previewctl/pkg/ssh"
)

var _ kctx.Loader = (*ConfigLoader)(nil)

const (
	k3sConfigPath        = "/etc/rancher/k3s/k3s.yaml"
	catK3sConfigCmd      = "sudo cat /etc/rancher/k3s/k3s.yaml"
	harvesterContextName = "harvester"
)

var (
	ErrK3SConfigNotFound = errors.New("k3s config file not found")
)

type ConfigLoader struct {
	logger *logrus.Logger

	sshClientFactory pssh.ClientFactory
	client           pssh.Client

	configPath      string
	opts            ConfigLoaderOpts
	harvesterClient *k8s.Config
}

type ConfigLoaderOpts struct {
	Logger *logrus.Logger

	PreviewName       string
	PreviewNamespace  string
	SSHPrivateKeyPath string
	SSHUser           string
}

func New(ctx context.Context, opts ConfigLoaderOpts) (*ConfigLoader, error) {
	key, err := os.ReadFile(opts.SSHPrivateKeyPath)
	if err != nil {
		return nil, err
	}

	signer, err := ssh.ParsePrivateKey(key)
	if err != nil {
		return nil, err
	}

	k8sClient, err := k8s.NewFromDefaultConfigWithContext(opts.Logger, harvesterContextName)
	if err != nil {
		return nil, err
	}

	config := &ConfigLoader{
		logger:          opts.Logger,
		harvesterClient: k8sClient,
		sshClientFactory: &pssh.FactoryImplementation{
			SSHConfig: &ssh.ClientConfig{
				User: opts.SSHUser,
				Auth: []ssh.AuthMethod{
					ssh.PublicKeys(signer),
				},
				HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			},
		},
		configPath: k3sConfigPath,
		opts:       opts,
	}

	return config, nil
}

func (k *ConfigLoader) Load(ctx context.Context) (*api.Config, error) {
	if k.client == nil {
		stopChan, readyChan, errChan := make(chan struct{}, 1), make(chan struct{}, 1), make(chan error, 1)
		go func() {
			err := k.setup(ctx, stopChan, readyChan, errChan)
			if err != nil {
				k.logger.WithFields(logrus.Fields{"err": err}).Error("failed to setup port-forward and ssh connection to VM")
			}
		}()

		select {
		case <-readyChan:
		case err := <-errChan:
			return nil, err
		}

		defer func(client pssh.Client) {
			// closing the stopChan will stop the port-forward
			close(stopChan)
			err := client.Close()
			if err != nil {
				k.logger.WithFields(logrus.Fields{"err": err}).Error("failed to close client")
				return
			}
		}(k.client)
	}

	return k.getContext(ctx)
}

func (k *ConfigLoader) getContext(ctx context.Context) (*api.Config, error) {
	stdout := new(bytes.Buffer)
	stderr := new(bytes.Buffer)

	err := k.client.Run(ctx, catK3sConfigCmd, stdout, stderr)
	if err != nil {
		if strings.Contains(stderr.String(), "No such file or directory") {
			return nil, ErrK3SConfigNotFound
		}

		return nil, errors.Wrap(err, stderr.String())
	}

	c, err := clientcmd.NewClientConfigFromBytes(stdout.Bytes())
	if err != nil {
		return nil, err
	}

	rc, err := c.RawConfig()
	if err != nil {
		return nil, err
	}

	k3sConfig, err := k8s.RenameConfig(&rc, "default", k.opts.PreviewName)
	if err != nil {
		return nil, err
	}

	k3sConfig.Clusters[k.opts.PreviewName].Server = fmt.Sprintf("https://%s.kube.gitpod-dev.com:6443", k.opts.PreviewName)

	return &rc, nil
}

func (k *ConfigLoader) setup(ctx context.Context, stopChan, readyChan chan struct{}, errChan chan error) error {
	// pick a random port, so we avoid clashes if something else port-forwards to 2200
	randPort := strconv.Itoa(rand.Intn(2299-2201) + 2201)
	// we use portForwardReadyChan to signal when we've started the port-forward
	portForwardReadyChan := make(chan struct{}, 1)
	go func() {
		podName, err := k.getVMPodName(ctx, k.opts.PreviewName, k.opts.PreviewNamespace)
		if err != nil {
			errChan <- err
			return
		}

		err = k.harvesterClient.PortForward(ctx, k8s.PortForwardOpts{
			Name:      podName,
			Namespace: k.opts.PreviewNamespace,
			Ports: []string{
				fmt.Sprintf("%s:2200", randPort),
			},
			ReadyChan: portForwardReadyChan,
			StopChan:  stopChan,
			ErrChan:   errChan,
		})

		if err != nil {
			errChan <- err
			return
		}
	}()

	var once sync.Once
	select {
	case <-portForwardReadyChan:
		once.Do(func() {
			err := k.connectToHost(ctx, "127.0.0.1", randPort)
			if err != nil {
				k.logger.Error(err)
				errChan <- err
				return
			}
			readyChan <- struct{}{}
		})
	case err := <-errChan:
		return err
	case <-time.After(time.Second * 50):
		return errors.New("timed out waiting for port forward")
	case <-ctx.Done():
		k.logger.Debug("context cancelled")
		return ctx.Err()
	}

	return nil
}

func (k *ConfigLoader) connectToHost(ctx context.Context, host, port string) error {
	client, err := k.sshClientFactory.Dial(ctx, host, port)
	if err != nil {
		return err
	}
	k.client = client

	return nil
}

func (k *ConfigLoader) Close() error {
	if err := k.client.Close(); err != nil {
		return err
	}

	k.client = nil
	return nil
}

func (k *ConfigLoader) getVMPodName(ctx context.Context, previewName, namespace string) (string, error) {
	// TODO: replace this with a call to SVC.Proxy and get the pod name from there
	labelSelector := metav1.LabelSelector{
		MatchLabels: map[string]string{
			"harvesterhci.io/vmName": previewName,
		},
	}

	pods, err := k.harvesterClient.CoreClient.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labels.Set(labelSelector.MatchLabels).String(),
	})

	if err != nil {
		return "", err
	}

	if len(pods.Items) != 1 {
		return "", errors.Newf("expected a single pod, got [%d]", len(pods.Items))
	}

	return pods.Items[0].Name, nil
}
