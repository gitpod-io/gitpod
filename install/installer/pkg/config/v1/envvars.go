// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package config

import (
	"fmt"
	"os"
	"reflect"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	v1 "k8s.io/api/core/v1"
	"k8s.io/utils/pointer"
	"sigs.k8s.io/yaml"
)

// isTruthy performs a case-insensitive match for values parsed as true
func isTruthy(input string) bool {
	trueValues := []string{
		"1",
		"y",
		"yes",
		"on",
		"true",
		"t",
	}

	for _, v := range trueValues {
		if strings.ToUpper(input) == strings.ToUpper(v) {
			return true
		}
	}

	return false
}

// ConfigEnvvars this maps the external environment variables to Golang values and forms part of our public contract
type ConfigEnvvars struct {
	AdvancedModeEnabled                  bool     `env:"ADVANCED_MODE_ENABLED"`
	ComponentProxyServiceType            string   `env:"COMPONENT_PROXY_SERVICE_SERVICETYPE"`
	ConfigPatchFile                      string   `env:"CONFIG_PATCH_FILE"`
	CustomizationPatchFile               string   `env:"CUSTOMIZATION_PATCH_FILE"`
	DBCloudSQLEnabled                    bool     `env:"DB_CLOUDSQL_ENABLED"`
	DBCloudSQLInstance                   string   `env:"DB_CLOUDSQL_INSTANCE"`
	DBCloudSQLServiceAccountName         string   `env:"DB_CLOUDSQL_SERVICE_ACCOUNT_NAME"`
	DBExternalCertificateName            string   `env:"DB_EXTERNAL_CERTIFICATE_NAME"`
	DBInClusterEnabled                   bool     `env:"DB_INCLUSTER_ENABLED"`
	Domain                               string   `env:"DOMAIN"`
	Distribution                         string   `env:"DISTRIBUTION"`
	ImagePullSecretName                  string   `env:"IMAGE_PULL_SECRET_NAME"`
	LicenseName                          string   `env:"LICENSE_NAME"`
	LocalRegistryAddress                 string   `env:"LOCAL_REGISTRY_ADDRESS"`
	LocalRegistryEnabled                 bool     `env:"HAS_LOCAL_REGISTRY"`
	LocalRegistryHost                    string   `env:"LOCAL_REGISTRY_HOST"`
	LocalRegistryImagePullConfig         string   `env:"LOCAL_REGISTRY_IMAGE_PULL_DOCKER_CONFIG_JSON"`
	OpenVSXUrl                           string   `env:"OPEN_VSX_URL"`
	RegistryDockerConfigEnabled          bool     `env:"REG_DOCKER_CONFIG_ENABLED"`
	RegistryDockerConfig                 string   `env:"REG_DOCKER_CONFIG_JSON"`
	RegistryInClusterEnabled             bool     `env:"REG_INCLUSTER_ENABLED"`
	RegistryInClusterStorageType         string   `env:"REG_INCLUSTER_STORAGE"`
	RegistryInClusterStorageS3BucketName string   `env:"REG_INCLUSTER_STORAGE_S3_BUCKETNAME"`
	RegistryInClusterStorageS3CertName   string   `env:"REG_INCLUSTER_STORAGE_S3_CERTIFICATE_NAME"`
	RegistryInClusterStorageS3Endpoint   string   `env:"REG_INCLUSTER_STORAGE_S3_ENDPOINT"`
	RegistryInClusterStorageS3Region     string   `env:"REG_INCLUSTER_STORAGE_S3_REGION"`
	RegistryExternalCertName             string   `env:"REG_EXTERNAL_CERTIFICATE_NAME"`
	RegistryExternalURL                  string   `env:"REG_URL"`
	SSHGatewayEnabled                    bool     `env:"SSH_GATEWAY"`
	SSHGatewayHostKeyName                string   `env:"SSH_GATEWAY_HOST_KEY_NAME"`
	StorageProvider                      string   `env:"STORE_PROVIDER" envDefault:"incluster"`
	StorageRegion                        string   `env:"STORE_REGION"`
	StorageAzureCredsName                string   `env:"STORE_AZURE_CREDENTIALS_NAME"`
	StorageGCPProjectName                string   `env:"STORE_GCP_PROJECT"`
	StorageGCPServiceAccountName         string   `env:"STORE_GCP_SERVICE_ACCOUNT_NAME"`
	StorageS3Bucket                      string   `env:"STORE_S3_BUCKET"`
	StorageS3CredsName                   string   `env:"STORE_S3_CREDENTIALS_NAME"`
	StorageS3Endpoint                    string   `env:"STORE_S3_ENDPOINT"`
	TLSSelfSignedEnabled                 bool     `env:"TLS_SELF_SIGNED_ENABLED"`
	TLSCertManagerEnabled                bool     `env:"CERT_MANAGER_ENABLED"`
	TLSCustomCACertEnabled               bool     `env:"TLS_CUSTOM_CA_CRT_ENABLED"`
	TLSCustomCACertCredsName             string   `env:"TLS_CUSTOM_CA_CRT_CREDENTIALS_NAME"`
	UserManagementBlockEnabled           bool     `env:"USER_MANAGEMENT_BLOCK_ENABLED"`
	UserManagementBlockPassList          []string `env:"USER_MANAGEMENT_BLOCK_PASSLIST"`
}

func (c *ConfigEnvvars) load() {
	t := reflect.TypeOf(*c)
	v := reflect.ValueOf(c).Elem()

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		tag := field.Tag.Get("env")
		defaultTag := field.Tag.Get("envDefault")

		envvar, ok := os.LookupEnv(tag)
		if !ok {
			envvar = defaultTag
		}

		valueField := v.Field(i)
		if valueField.IsValid() && valueField.CanSet() {
			switch valueField.Kind() {
			case reflect.Bool:
				valueField.SetBool(isTruthy(envvar))
			case reflect.Slice:
				// This only currently works for slices of strings
				sliceValue := strings.Split(envvar, ",")
				slice := reflect.MakeSlice(reflect.SliceOf(field.Type.Elem()), 0, len(sliceValue))

				for _, i := range sliceValue {
					// Clean up any whitespace and append to slice
					slice = reflect.Append(slice, reflect.ValueOf(strings.TrimSpace(i)))
				}

				valueField.Set(slice)
			default:
				valueField.SetString(envvar)
			}
		}
	}
}

// BuildFromEnvvars complete the configuration based on envvars - this will remove existing values
func (v version) BuildFromEnvvars(in interface{}) error {
	cfg, ok := in.(*Config)
	if !ok {
		return config.ErrInvalidType
	}

	envvars := ConfigEnvvars{}
	envvars.load()

	log.Infof("Detected envvars: %+v", envvars)

	cfg.Domain = envvars.Domain

	if licenseName := envvars.LicenseName; licenseName != "" {
		log.Info("Setting license name")
		cfg.License = &ObjectRef{
			Kind: ObjectRefSecret,
			Name: licenseName,
		}
	} else {
		cfg.License = nil
	}

	log.Info("Setting Open VSX URL")
	cfg.OpenVSX = OpenVSX{
		URL: func() string {
			if v := envvars.OpenVSXUrl; v != "" {
				return v
			}
			return defaultMetadataRegion
		}(),
	}

	log.Infof("DB incluster: %v", envvars.DBInClusterEnabled)

	cfg.Database.InCluster = pointer.Bool(true)
	cfg.Database.CloudSQL = nil
	cfg.Database.External = nil

	if !envvars.DBInClusterEnabled {
		cfg.Database.InCluster = pointer.Bool(false)

		if envvars.DBCloudSQLEnabled {
			log.Info("Configuring CloudSQLProxy for database")
			cfg.Database.CloudSQL = &DatabaseCloudSQL{
				Instance: envvars.DBCloudSQLInstance,
				ServiceAccount: ObjectRef{
					Kind: ObjectRefSecret,
					Name: envvars.DBCloudSQLServiceAccountName,
				},
			}
		} else {
			log.Info("Configuring external database")
			cfg.Database.External = &DatabaseExternal{
				Certificate: ObjectRef{
					Kind: ObjectRefSecret,
					Name: envvars.DBExternalCertificateName,
				},
			}
		}
	}

	cfg.Repository = defaultRepositoryUrl
	cfg.ImagePullSecrets = []ObjectRef{}
	cfg.DropImageRepo = pointer.Bool(false)
	cfg.ContainerRegistry.PrivateBaseImageAllowList = []string{}

	if envvars.LocalRegistryEnabled {
		log.Info("Configuring mirrored container registry for airgapped installation")

		cfg.Repository = envvars.LocalRegistryAddress
		cfg.ImagePullSecrets = append(cfg.ImagePullSecrets, ObjectRef{
			Kind: ObjectRefSecret,
			Name: envvars.ImagePullSecretName,
		})
		cfg.DropImageRepo = pointer.Bool(true)

		cfg.ContainerRegistry.PrivateBaseImageAllowList = append(cfg.ContainerRegistry.PrivateBaseImageAllowList, envvars.LocalRegistryHost)
	}

	if envvars.RegistryDockerConfigEnabled {
		var res struct {
			Auths map[string]interface{} `json:"auths"`
		}
		if err := yaml.Unmarshal([]byte(envvars.RegistryDockerConfig), &res); err != nil {
			return err
		}

		for registry := range res.Auths {
			cfg.ContainerRegistry.PrivateBaseImageAllowList = append(cfg.ContainerRegistry.PrivateBaseImageAllowList, registry)
		}
	}

	if len(cfg.ContainerRegistry.PrivateBaseImageAllowList) > 0 {
		// Docker should always be in allow list if other values set
		cfg.ContainerRegistry.PrivateBaseImageAllowList = append(cfg.ContainerRegistry.PrivateBaseImageAllowList, "docker.io")
	}

	log.Infof("Registry incluster: %v", envvars.RegistryInClusterEnabled)

	cfg.ContainerRegistry.InCluster = pointer.Bool(true)
	cfg.ContainerRegistry.External = nil
	cfg.ContainerRegistry.S3Storage = nil
	if !envvars.RegistryInClusterEnabled {
		log.Info("Configuring external container registry")

		// @todo(sje) merge in the external-container-registry secret

		cfg.ContainerRegistry.InCluster = pointer.Bool(false)
		cfg.ContainerRegistry.External = &ContainerRegistryExternal{
			URL: envvars.RegistryExternalURL,
			Certificate: ObjectRef{
				Kind: ObjectRefSecret,
				Name: envvars.RegistryExternalCertName,
			},
		}
	} else {
		if envvars.RegistryInClusterStorageType == "s3" {
			log.Info("Configuring in-cluster container registry S3 storage")

			cfg.ContainerRegistry.S3Storage = &S3Storage{
				Region:   envvars.RegistryInClusterStorageS3Region,
				Endpoint: envvars.RegistryInClusterStorageS3Endpoint,
				Bucket:   envvars.RegistryInClusterStorageS3BucketName,
				Certificate: ObjectRef{
					Kind: ObjectRefSecret,
					Name: envvars.RegistryInClusterStorageS3CertName,
				},
			}
		}
	}

	log.Infof("Storage provider: %s", envvars.StorageProvider)

	cfg.ObjectStorage.InCluster = pointer.Bool(true)
	cfg.Metadata.Region = defaultMetadataRegion
	cfg.ObjectStorage.Azure = nil
	cfg.ObjectStorage.CloudStorage = nil
	cfg.ObjectStorage.S3 = nil
	if storageProvider := envvars.StorageProvider; storageProvider != "incluster" {
		log.Info("Configuring the storage provider")

		cfg.Metadata.Region = envvars.StorageRegion
		cfg.ObjectStorage.InCluster = pointer.Bool(false)

		switch storageProvider {
		case "azure":
			log.Infof("Configuring storage for Azure")
			cfg.ObjectStorage.Azure = &ObjectStorageAzure{
				Credentials: ObjectRef{
					Kind: ObjectRefSecret,
					Name: envvars.StorageAzureCredsName,
				},
			}
		case "gcp":
			log.Infof("Configuring storage for GCP")
			cfg.ObjectStorage.CloudStorage = &ObjectStorageCloudStorage{
				Project: envvars.StorageGCPProjectName,
				ServiceAccount: ObjectRef{
					Kind: ObjectRefSecret,
					Name: envvars.StorageGCPServiceAccountName,
				},
			}
		case "s3":
			log.Infof("Configuring storage for S3")
			cfg.ObjectStorage.S3 = &ObjectStorageS3{
				Endpoint:   envvars.StorageS3Endpoint,
				BucketName: envvars.StorageS3Bucket,
				Credentials: ObjectRef{
					Kind: ObjectRefSecret,
					Name: envvars.StorageS3CredsName,
				},
			}
		default:
			return fmt.Errorf("unknown storage provider: %s", storageProvider)
		}
	}

	cfg.SSHGatewayHostKey = nil
	if envvars.SSHGatewayEnabled {
		log.Info("Configuring SSH gateway host key")
		cfg.SSHGatewayHostKey = &ObjectRef{
			Kind: ObjectRefSecret,
			Name: envvars.SSHGatewayHostKeyName,
		}
	}

	cfg.CustomCACert = nil
	cfg.CustomCACert = nil
	if envvars.TLSSelfSignedEnabled {
		log.Info("Generating a self-signed certificate with the internal CA")
		cfg.CustomCACert = &ObjectRef{
			Kind: ObjectRefSecret,
			Name: "ca-issuer-ca", // This comes from common/constants.go
		}
	} else if !envvars.TLSCertManagerEnabled && envvars.TLSCustomCACertEnabled {
		log.Info("Setting the CA to be used for the certificate")
		cfg.CustomCACert = &ObjectRef{
			Kind: ObjectRefSecret,
			Name: envvars.TLSCustomCACertCredsName,
		}
	}

	cfg.BlockNewUsers.Enabled = false
	cfg.BlockNewUsers.Passlist = []string{}
	if envvars.UserManagementBlockEnabled {
		log.Info("Enabling user management")
		cfg.BlockNewUsers.Enabled = true

		for _, domain := range envvars.UserManagementBlockPassList {
			log.Infof("Adding domain %s to block new users pass list", domain)
			cfg.BlockNewUsers.Passlist = append(cfg.BlockNewUsers.Passlist, domain)
		}
	}

	cfg.Components = nil
	cfg.Customization = nil
	if envvars.AdvancedModeEnabled {
		log.Info("Applying advanced configuration")

		if serviceType := envvars.ComponentProxyServiceType; serviceType != "" {
			log.Infof("Applying proxy service type: %s", serviceType)
			cfg.Components = &Components{
				Proxy: &ProxyComponent{
					Service: &ComponentTypeService{
						ServiceType: (*v1.ServiceType)(&serviceType),
					},
				},
			}
		}

		if customizationPatchFile := envvars.CustomizationPatchFile; customizationPatchFile != "" {
			log.Info("Applying customization")

			var customization Config
			err := yaml.Unmarshal([]byte(customizationPatchFile), &customization)
			if err != nil {
				return err
			}

			if customization.Customization == nil {
				log.Info("No customization components added")
			} else {
				log.Infof("Adding %+v customization param(s)", *customization.Customization)
			}

			cfg.Customization = customization.Customization
		}
	} else {
		log.Info("No advanced configuration applied")
	}

	if cfg.Experimental == nil {
		cfg.Experimental = &experimental.Config{}
	}

	if telemetryValue := envvars.Distribution; telemetryValue != "" {
		if cfg.Experimental.Telemetry == nil {
			cfg.Experimental.Telemetry = &experimental.TelemetryConfig{}
		}
		cfg.Experimental.Telemetry.Data.Platform = telemetryValue
	}

	if cfgPatchFile := envvars.ConfigPatchFile; cfgPatchFile != "" {
		log.Warnf("Applying patch customization - this may overwrite all settings: %+v", cfgPatchFile)

		err := yaml.Unmarshal([]byte(cfgPatchFile), &cfg)
		if err != nil {
			return err
		}
	}

	return nil
}
