// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

type Config struct {
	// Installation type to run - for most users, this will be Full
	Kind InstallationKind `json:"kind" validate:"required,installation_kind"`

	Domain       string   `json:"domain" validate:"required,fqdn"`
	Metadata     Metadata `json:"metadata"`
	PullRegistry string   `json:"pullRegistry" validate:"required,ascii"`

	Observability Observability `json:"observability"`
	Analytics     *Analytics    `json:"analytics,omitempty"`

	ContainerRegistry ContainerRegistry `json:"containerRegistry" validate:"required"`
	ImagePullSecrets  []ObjectRef       `json:"imagePullSecrets,omitempty"`

	HTTPProxy *ObjectRef `json:"httpProxy,omitempty"`

	CustomCACert *ObjectRef `json:"customCACert,omitempty"`

	DropImageRepo *bool `json:"dropImageRepo,omitempty"`

	Customization *[]Customization `json:"customization,omitempty"`

	Components *Components `json:"components,omitempty"`
}
