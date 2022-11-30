// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"context"
	"fmt"
	"regexp"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"golang.org/x/crypto/ssh"
	"sigs.k8s.io/yaml"

	"github.com/go-playground/validator/v10"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/rest"
)

var InstallationKindList = map[InstallationKind]struct{}{
	InstallationIDE:       {},
	InstallationWebApp:    {},
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

var LicensorTypeList = map[LicensorType]struct{}{
	LicensorTypeGitpod:     {},
	LicensorTypeReplicated: {},
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
		"block_new_users_passlist": func(fl validator.FieldLevel) bool {
			if !fl.Parent().FieldByName("Enabled").Bool() {
				// Not enabled - it's valid
				return true
			}

			if fl.Field().Len() == 0 {
				// No exceptions
				return false
			}

			// Use same regex as "fqdn"
			// @link https://github.com/go-playground/validator/blob/c7e0172e0fd176bdc521afb5186818a7db6b77ac/regexes.go#L52
			fqdnRegexStringRFC1123 := `^([a-zA-Z0-9]{1}[a-zA-Z0-9-]{0,62})(\.[a-zA-Z0-9]{1}[a-zA-Z0-9-]{0,62})*?(\.[a-zA-Z]{1}[a-zA-Z0-9]{0,62})\.?$`
			fqdnRegexRFC1123 := regexp.MustCompile(fqdnRegexStringRFC1123)

			for i := 0; i < fl.Field().Len(); i++ {
				val := fl.Field().Index(i).String()

				if val == "" {
					// Empty value
					return false
				}

				// Check that it validates as a fully-qualified domain name
				valid := fqdnRegexRFC1123.MatchString(val)
				if !valid {
					return false
				}
			}
			return true
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

	res = append(res, cluster.CheckSecret(cfg.PersonalAccessTokenSigningKey.Name, cluster.CheckSecretRequiredData("personal-access-token-signing-key")))
	res = append(res, cluster.ValidationCheck{
		Name:        "affinity labels",
		Check:       checkAffinityLabels(getAffinityListByKind(cfg.Kind)),
		Description: "all required affinity node labels " + fmt.Sprint(getAffinityListByKind(cfg.Kind)) + " are present in the cluster",
	})

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

		if cfg.ContainerRegistry.External.Credentials != nil {
			credSecretName := cfg.ContainerRegistry.External.Credentials.Name
			res = append(res, cluster.CheckSecret(credSecretName, cluster.CheckSecretRequiredData("credentials")))
		}
	}

	if cfg.ContainerRegistry.S3Storage != nil {
		secretName := cfg.ContainerRegistry.S3Storage.Certificate.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("s3AccessKey", "s3SecretKey")))
	}

	if cfg.Database.CloudSQL != nil {
		secretName := cfg.Database.CloudSQL.ServiceAccount.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("credentials.json", "encryptionKeys", "password", "username")))
	}

	if cfg.Database.External != nil {
		secretName := cfg.Database.External.Certificate.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("encryptionKeys", "host", "password", "port", "username")))
	}

	if cfg.Database.SSL != nil && cfg.Database.SSL.CaCert != nil {
		secretName := cfg.Database.SSL.CaCert.Name
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("ca.crt")))
	}

	if cfg.License != nil {
		secretName := cfg.License.Name
		licensorKey := "type"
		res = append(res, cluster.CheckSecret(secretName, cluster.CheckSecretRequiredData("license"), cluster.CheckSecretRecommendedData(licensorKey), cluster.CheckSecretRule(func(s *corev1.Secret) ([]cluster.ValidationError, error) {
			errors := make([]cluster.ValidationError, 0)

			licensor := LicensorType(s.Data[licensorKey])
			if licensor != "" {
				// This field is optional, so blank is valid
				_, ok := LicensorTypeList[licensor]

				if !ok {
					errors = append(errors, cluster.ValidationError{
						Message: fmt.Sprintf("Secret '%s' has invalid license type '%s'", secretName, licensor),
						Type:    cluster.ValidationStatusError,
					})
				}
			}

			return errors, nil
		})))
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

	if cfg.CustomCACert != nil {
		res = append(res, cluster.CheckSecret(cfg.CustomCACert.Name, cluster.CheckSecretRequiredData("ca.crt")))
	}

	res = append(res, experimental.ClusterValidation(cfg.Experimental)...)

	return res
}

// checkAffinityLabels validates that the nodes have all the required affinity labels applied
// It assumes all the values are `true`
func checkAffinityLabels(targetAffinityList []string) func(context.Context, *rest.Config, string) ([]cluster.ValidationError, error) {
	return func(ctx context.Context, config *rest.Config, namespace string) ([]cluster.ValidationError, error) {
		nodes, err := cluster.ListNodesFromContext(ctx, config)
		if err != nil {
			return nil, err
		}

		affinityList := map[string]bool{}
		for _, affinity := range targetAffinityList {
			affinityList[affinity] = false
		}

		var res []cluster.ValidationError
		for _, node := range nodes {
			for k, v := range node.GetLabels() {
				if _, found := affinityList[k]; found {
					affinityList[k] = v == "true"
				}
			}
		}

		// Check all the values in the map are `true`
		for k, v := range affinityList {
			if !v {
				res = append(res, cluster.ValidationError{
					Message: "Affinity label not found in cluster: " + k,
					Type:    cluster.ValidationStatusError,
				})
			}
		}
		return res, nil
	}
}

func getAffinityListByKind(kind InstallationKind) []string {
	var affinityList []string
	switch kind {
	case InstallationMeta:
		affinityList = cluster.AffinityListMeta
	case InstallationWorkspace:
		affinityList = cluster.AffinityListWorkspace
	default:
		affinityList = cluster.AffinityList
	}
	return affinityList
}
