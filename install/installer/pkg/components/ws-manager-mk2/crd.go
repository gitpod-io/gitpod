// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package wsmanagermk2

import (
	_ "embed"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"golang.org/x/xerrors"
	apiextensions "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
)

// todo(sje): establish how to pass in config with cw
func crd(ctx *common.RenderContext) ([]runtime.Object, error) {
	scheme := runtime.NewScheme()
	if err := apiextensions.AddToScheme(scheme); err != nil {
		return nil, err
	}
	decode := serializer.NewCodecFactory(scheme).UniversalDeserializer().Decode

	segs := strings.Split(crdYAML, "---\n")
	res := make([]runtime.Object, 0, len(segs))

	for _, doc := range segs {
		obj, _, err := decode([]byte(doc), nil, nil)
		if err != nil && strings.Contains(err.Error(), "Object 'Kind' is missing") {
			continue
		}
		if err != nil {
			return nil, xerrors.Errorf("cannot load workspace CRD: %w", err)
		}

		res = append(res, obj)
	}

	return res, nil
}

//go:embed crd.yaml
var crdYAML string
