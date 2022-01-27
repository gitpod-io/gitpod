// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"golang.org/x/crypto/ssh"
	"sigs.k8s.io/yaml"

	"github.com/go-playground/validator/v10"
	corev1 "k8s.io/api/core/v1"
)

var InstallationKindList = map[InstallationKind]struct{}{
	InstallationMeta:      {},
	InstallationWorkspace: {},
	InstallationFull:      {},
}

var LogLevelList = map[LogLevel]struct{}{
	LogLevelTrace:   {},
	LogLevelDebug:   {},
	LogLevelInfo:    {},
	LogLevelWarning: {},
	LogLevelError:   {},
	LogLevelFatal:   {},
	LogLevelPanic:   {},
}

var ObjectRefKindList = map[ObjectRefKind]struct{}{
	ObjectRefSecret: {},
}

var FSShiftMethodList = map[FSShiftMethod]struct{}{
	FSShiftFuseFS:  {},
	FSShiftShiftFS: {},
}

// LoadValidationFuncs load custom validation functions for this version of the config API
func (v version) LoadValidationFuncs(validate *validator.Validate) error {
	funcs := map[string]validator.Func{
		"objectref_kind": func(fl validator.FieldLevel) bool {
			_, ok := ObjectRefKindList[ObjectRefKind(fl.Field().String())]
			return ok
		},
		"fs_shift_method": func(fl validator.FieldLevel) bool {
			_, ok := FSShiftMethodList[FSShiftMethod(fl.Field().String())]
			return ok
		},
		"installation_kind": func(fl validator.FieldLevel) bool {
			_, ok := InstallationKindList[InstallationKind(fl.Field().String())]
			return ok
		},
		"log_level": func(fl validator.FieldLevel) bool {
			_, ok := LogLevelList[LogLevel(fl.Field().String())]
			return ok
		},
	}

	for k, v := range experimental.ValidationChecks {
		funcs[k] = v
	}

	for n, f := range funcs {
		err := validate.RegisterValidation(n, f)
		if err != nil {
			return err
		}
	}

	return nil
}

// ClusterValidation introduces configuration specific cluster validation checks
func (v version) ClusterValidation(rcfg interface{}) cluster.ValidationChecks {
	cfg := rcfg.(*Config)

	var res cluster.ValidationChecks
	res = append(res, cluster.CheckSecret(cfg.Certificate.Name, cluster.CheckSecretRequiredData("tls.crt", "tls.key")))

	if cfg.ObjectStorage.CloudStorage != nil {
		secretName := cfg.ObjectStorage.CloudStorage.ServiceAccount.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("service-account.json")))
	}

	if cfg.ObjectStorage.Azure != nil {
		secretName := cfg.ObjectStorage.Azure.Credentials.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("accountName", "accountKey")))
	}

	if cfg.ObjectStorage.S3 != nil {
		secretName := cfg.ObjectStorage.S3.Credentials.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("accessKeyId", "secretAccessKey")))
	}

	if cfg.ContainerRegistry.External != nil {
		secretName := cfg.ContainerRegistry.External.Certificate.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData(".dockerconfigjson")))
	}

	if cfg.Database.CloudSQL != nil {
		secretName := cfg.Database.CloudSQL.ServiceAccount.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("credentials.json", "encryptionKeys", "password", "username")))
	}

	if cfg.Database.External != nil {
		secretName := cfg.Database.External.Certificate.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("encryptionKeys", "host", "password", "port", "username")))
	}

	if cfg.License != nil {
		secretName := cfg.License.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("license")))
	}

	if len(cfg.AuthProviders) > 0 {
		for _, provider := range cfg.AuthProviders {
			secretName := provider.Name
			secretKey := "provider"
			res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData(secretKey), cluster.CheckSecretRule(func(s *corev1.Secret) ([]cluster.ValidationError, error) {
				errors := make([]cluster.ValidationError, 0)
				providerData := s.Data[secretKey]

				var provider AuthProviderConfigs
				err := yaml.Unmarshal(providerData, &provider)
				if err != nil {
					return nil, err
				}

				validate := validator.New()
				err = v.LoadValidationFuncs(validate)
				if err != nil {
					return nil, err
				}

				err = validate.Struct(provider)
				if err != nil {
					validationErrors := err.(validator.ValidationErrors)

					if len(validationErrors) > 0 {
						for _, v := range validationErrors {
							errors = append(errors, cluster.ValidationError{
								Message: fmt.Sprintf("Field '%s' failed %s validation", v.Namespace(), v.Tag()),
								Type:    cluster.ValidationStatusError,
							})
						}
					}
				}

				return errors, nil
			})))
		}
	}

	if cfg.SSHGatewayHostKey != nil {
		secretName := cfg.SSHGatewayHostKey.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRule(func(s *corev1.Secret) ([]cluster.ValidationError, error) {
			var signers []ssh.Signer
			errors := make([]cluster.ValidationError, 0)
			for field, value := range s.Data {
				hostSigner, err := ssh.ParsePrivateKey(value)
				if err != nil {
					errors = append(errors, cluster.ValidationError{
						Message: fmt.Sprintf("Field '%s' can't parse to host key %v", field, err),
						Type:    cluster.ValidationStatusWarning,
					})
					continue
				}
				signers = append(signers, hostSigner)
			}
			if len(signers) == 0 {
				errors = append(errors, cluster.ValidationError{
					Message: fmt.Sprintf("Secret '%s' does not contain a valid host key", secretName),
					Type:    cluster.ValidationStatusError,
				})
			}
			return errors, nil
		})))
	}
	return res
}
