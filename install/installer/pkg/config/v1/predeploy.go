// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package config

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"k8s.io/client-go/kubernetes"
)

func createSSHGatewaySecret(cfg *Config, envvars ConfigEnvvars, clientset *kubernetes.Clientset, namespace string) error {
	if cfg.SSHGatewayHostKey == nil {
		log.Info("No SSH gateway configured")
		return nil
	}

	log.Info("Creating SSH gateway host key")

	privateKey, err := rsa.GenerateKey(rand.Reader, 3072)
	if err != nil {
		return err
	}

	privateKeyPEM := &pem.Block{Type: "OPENSSH PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privateKey)}

	secretClient := clientset.CoreV1().Secrets(namespace)

	// List all currently deployed jobs
	secretList, err := secretClient.List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return err
	}

	secretExists := false
	for _, j := range secretList.Items {
		if j.Name == cfg.SSHGatewayHostKey.Name {
			secretExists = true
			continue
		}
	}

	if secretExists {
		log.Info("SSH gateway host secret exists - this will not be recreated")
	} else {
		log.Info("Creating SSH gateway host secret")

		secret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name: cfg.SSHGatewayHostKey.Name,
			},
			Type: corev1.SecretTypeOpaque,
			Data: map[string][]byte{
				"host.key": pem.EncodeToMemory(privateKeyPEM),
			},
		}
		_, err = secretClient.Create(context.TODO(), secret, metav1.CreateOptions{})
		if err != nil {
			return err
		}
	}

	return nil
}

func (v version) PreDeploy(in interface{}, clientset *kubernetes.Clientset, namespace string) error {
	cfg, ok := in.(*Config)
	if !ok {
		return config.ErrInvalidType
	}

	envvars := ConfigEnvvars{}
	envvars.load()

	log.Infof("Detected envvars: %+v", envvars)

	if err := createSSHGatewaySecret(cfg, envvars, clientset, namespace); err != nil {
		return err
	}

	return nil
}
