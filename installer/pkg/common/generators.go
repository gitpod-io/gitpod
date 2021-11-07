// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"fmt"
	"github.com/manifoldco/promptui"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

type GeneratorFuncResult map[string][]byte

type GeneratorFunc func(ctx *RenderContext) ([]runtime.Object, error)

var Generators = map[string]GeneratorFunc{
	"database": generateDatabaseSecret,
}

func required(input string) error {
	if len(input) == 0 {
		return fmt.Errorf("field is required")
	}
	return nil
}

func generateDatabaseSecret(ctx *RenderContext) ([]runtime.Object, error) {
	if pointer.BoolDeref(ctx.Config.Database.InCluster, false) == true {
		return nil, fmt.Errorf("database set to in cluster")
	}

	if ctx.Config.Database.RDS == nil || ctx.Config.Database.RDS.Certificate == nil || ctx.Config.Database.RDS.Certificate.Name == "" {
		return nil, fmt.Errorf("database name not set")
	}
	name := ctx.Config.Database.RDS.Certificate.Name

	prompts := []promptui.Prompt{{
		Label:    "host",
		Default:  "",
		Validate: required,
	}, {
		Label:    "username",
		Default:  "gitpod",
		Validate: required,
	}, {
		Label:    "password",
		Default:  "",
		Validate: required,
		Mask:     '*',
	}, {
		Label:    "port",
		Default:  "3306",
		Validate: required,
	}, {
		Label:    "database",
		Default:  "gitpod",
		Validate: required,
	}}

	data := map[string][]byte{}
	for _, prompt := range prompts {
		result, err := prompt.Run()
		if err != nil {
			return nil, err
		}

		data[prompt.Label.(string)] = []byte(result)
	}

	return []runtime.Object{&corev1.Secret{
		TypeMeta: TypeMetaSecret,
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ctx.Namespace,
			Labels:    DefaultLabels(MySQLComponent),
		},
		Data: data,
	}}, nil
}
