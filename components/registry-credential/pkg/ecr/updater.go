// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ecr

import (
	"context"
	"encoding/base64"
	"encoding/json"

	corev1 "k8s.io/api/core/v1"
	k8serr "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	aws "github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	awscred "github.com/aws/aws-sdk-go-v2/credentials"
	ecr "github.com/aws/aws-sdk-go-v2/service/ecr"
	ecrType "github.com/aws/aws-sdk-go-v2/service/ecr/types"
	"github.com/docker/cli/cli/config/credentials"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/registry-credential/pkg/config"
)

const (
	accessKeyIdPropName     = "access_key_id"
	secretAccessKeyPropName = "secret_access_key"
)

const (
	ecrUpdaterExpiresAt = "ecr-updater/expires-at"
)

// DockerConfigJSON represents ~/.docker/config.json file info
// see https://github.com/docker/docker/pull/12009
type DockerConfigJSON struct {
	Auths DockerConfig `json:"auths"`
}

// DockerConfig represents the config file used by the docker CLI.
// This config that represents the credentials that should be used
// when pulling images from specific image repositories.
type DockerConfig map[string]DockerConfigEntry

type DockerConfigEntry struct {
	Auth string `json:"auth"`
}

func UpdateCredential(client *kubernetes.Clientset, cfg *config.Configuration) {
	credSecret, err := getSecret(client, cfg.Namespace, cfg.CredentialSecret)
	if err != nil {
		log.WithError(err).Fatalf("cannot find the credential secret %s/%s", cfg.CredentialSecret, cfg.Namespace)
	}

	accessKey := string(credSecret.Data[accessKeyIdPropName])
	secretKey := string(credSecret.Data[secretAccessKeyPropName])
	region := cfg.Region

	log.Infof("Prepare to rotate AWS ECR secret %s/%s for region %s", cfg.SecretToUpdate, cfg.Namespace, region)

	awsConfig, err := newAWSConfig(region, accessKey, secretKey, "")
	if err != nil {
		log.WithError(err).Fatal("unable to new aws config")
	}

	// Get an authorization token from ECR
	ecrClient := ecr.NewFromConfig(awsConfig)
	result, err := ecrClient.GetAuthorizationToken(context.TODO(), &ecr.GetAuthorizationTokenInput{})
	if err != nil {
		log.WithError(err).Fatal("unable to get an Authorization token from ECR")
	}
	log.Infof("Found %d authorizationData", len(result.AuthorizationData))

	secretToUpdate, err := getSecret(client, cfg.Namespace, cfg.SecretToUpdate)
	if err != nil {
		if !k8serr.IsNotFound(err) {
			log.WithError(err).Fatalf("cannot find the secret to update %s/%s", cfg.SecretToUpdate, cfg.Namespace)
		}

		secretToCreate := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      cfg.SecretToUpdate,
				Namespace: cfg.Namespace,
				Labels: map[string]string{
					"app":       "gitpod",
					"component": "registry-credential",
				},
			},
			Type: corev1.SecretTypeDockerConfigJson,
			StringData: map[string]string{
				".dockerconfigjson": "{}",
			},
		}

		secretToUpdate, err = createSecret(client, cfg.Namespace, secretToCreate)
		if err != nil {
			log.WithError(err).Fatalf("cannot create the secret %s/%s", cfg.SecretToUpdate, cfg.Namespace)
		}
	}

	err = updateSecretFromToken(client, cfg.Namespace, secretToUpdate, result.AuthorizationData[0])
	if err != nil {
		log.WithError(err).Fatalf("Unable to update secret")
	}

	log.Infof("Secret %s/%s for region %s updated with new ECR credentials", cfg.SecretToUpdate, cfg.Namespace, region)
}

func newAWSConfig(region, accessKeyId, secretAccessKey, session string) (aws.Config, error) {
	return awsconfig.LoadDefaultConfig(
		context.TODO(),
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(
			awscred.NewStaticCredentialsProvider(
				accessKeyId,
				secretAccessKey,
				session,
			),
		),
	)
}

// getSecret returns the Kubernetes secret.
func getSecret(client *kubernetes.Clientset, namespace, secretName string) (*corev1.Secret, error) {
	return client.CoreV1().Secrets(namespace).Get(context.TODO(), secretName, metav1.GetOptions{})
}

// createSecret creates the Kubernetes secret.
func createSecret(client *kubernetes.Clientset, namespace string, secret *corev1.Secret) (*corev1.Secret, error) {
	return client.CoreV1().Secrets(namespace).Create(context.TODO(), secret, metav1.CreateOptions{})
}

// updateSecretFromToken updates a Kubernetes secret with the given AWS ECR AuthorizationData.
func updateSecretFromToken(client *kubernetes.Clientset, namespace string, secret *corev1.Secret, authorizationData ecrType.AuthorizationData) error {
	if secret.Data == nil {
		secret.Data = make(map[string][]byte)
	}
	if secret.Annotations == nil {
		secret.Annotations = make(map[string]string)
	}

	dockerConfigJson := DockerConfigJSON{}
	if err := json.Unmarshal(secret.Data[".dockerconfigjson"], &dockerConfigJson); err != nil {
		log.Errorf("Unable to unmarshal .dockerconfigjson")
		return err
	}

	json, err := buildDockerJSONConfig(dockerConfigJson, authorizationData)
	if err != nil {
		log.Errorf("Unable to build dockerJsonConfig from AuthorizationData")
		return err
	}

	secret.Annotations[ecrUpdaterExpiresAt] = aws.ToTime(authorizationData.ExpiresAt).String()
	secret.Data[".dockerconfigjson"] = json
	_, err = client.CoreV1().Secrets(namespace).Update(context.TODO(), secret, metav1.UpdateOptions{})
	return err
}

func buildDockerJSONConfig(dockerConfigJson DockerConfigJSON, authorizationData ecrType.AuthorizationData) ([]byte, error) {
	user := "AWS"
	token := aws.ToString(authorizationData.AuthorizationToken)
	password := decodePassword(token)
	password = password[4:]

	if dockerConfigJson.Auths == nil {
		dockerConfigJson.Auths = make(DockerConfig)
	}
	endpoint := credentials.ConvertToHostname(aws.ToString(authorizationData.ProxyEndpoint))
	dockerConfigJson.Auths[endpoint] = DockerConfigEntry{
		Auth: encodeDockerConfigFieldAuth(user, password),
	}
	return json.Marshal(dockerConfigJson)
}

func decodePassword(pass string) string {
	bytes, _ := base64.StdEncoding.DecodeString(pass)
	return string(bytes)
}

func encodeDockerConfigFieldAuth(username, password string) string {
	fieldValue := username + ":" + password
	return base64.StdEncoding.EncodeToString([]byte(fieldValue))
}
