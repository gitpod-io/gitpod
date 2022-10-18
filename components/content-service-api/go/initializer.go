// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package api

import (
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/xerrors"
)

// GetCheckoutLocationsFromInitializer returns a list of all checkout locations from the initializer
func GetCheckoutLocationsFromInitializer(init *WorkspaceInitializer) []string {
	var res []string
	_ = WalkInitializer(nil, init, func(path []string, init *WorkspaceInitializer) error {
		switch spec := init.Spec.(type) {
		case *WorkspaceInitializer_Git:
			res = append(res, spec.Git.CheckoutLocation)
		case *WorkspaceInitializer_Backup:
			res = append(res, spec.Backup.CheckoutLocation)

		case *WorkspaceInitializer_Prebuild:
			// walkInitializer will visit the Git initializer
		}

		return nil
	})
	return res
}

const extractedSecretPrefix = "extracted-secret/"

// GatherSecretsFromInitializer collects all from an initializer. This function does not
// alter the initializer in any way.
func GatherSecretsFromInitializer(init *WorkspaceInitializer) map[string]string {
	return extractSecretsFromInitializer(init, false)
}

// ExtractAndReplaceSecretsFromInitializer removes secrets to the initializer.
// This function alters the initializer, which only becomes useful calling InjectSecretsToInitializer.
// This is the counterpart of InjectSecretsToInitializer.
func ExtractAndReplaceSecretsFromInitializer(init *WorkspaceInitializer) map[string]string {
	return extractSecretsFromInitializer(init, true)
}

func extractSecretsFromInitializer(init *WorkspaceInitializer, replaceValue bool) map[string]string {
	res := make(map[string]string)

	_ = WalkInitializer([]string{"initializer"}, init, func(path []string, init *WorkspaceInitializer) error {
		git, ok := init.Spec.(*WorkspaceInitializer_Git)
		if !ok {
			return nil
		}

		pwd := git.Git.Config.AuthPassword
		if pwd == "" || strings.HasPrefix(pwd, extractedSecretPrefix) {
			return nil
		}

		name := strings.Join(path, ".")
		res[name] = pwd

		if replaceValue {
			git.Git.Config.AuthPassword = extractedSecretPrefix + name
		}

		return nil
	})

	return res
}

// InjectSecretsToInitializer injects secrets to the initializer. This is the counterpart of ExtractSecretsFromInitializer.
func InjectSecretsToInitializer(init *WorkspaceInitializer, secrets map[string][]byte) error {
	return WalkInitializer([]string{"initializer"}, init, func(path []string, init *WorkspaceInitializer) error {
		git, ok := init.Spec.(*WorkspaceInitializer_Git)
		if !ok {
			return nil
		}

		pwd := git.Git.Config.AuthPassword
		if !strings.HasPrefix(pwd, extractedSecretPrefix) {
			return nil
		}

		name := strings.TrimPrefix(pwd, extractedSecretPrefix)
		val, ok := secrets[name]
		if !ok {
			return xerrors.Errorf("secret %s not found", name)
		}

		git.Git.Config.AuthPassword = string(val)

		return nil
	})
}

// WalkInitializer walks the initializer structure
func WalkInitializer(path []string, init *WorkspaceInitializer, visitor func(path []string, init *WorkspaceInitializer) error) error {
	if init == nil {
		return nil
	}

	switch spec := init.Spec.(type) {
	case *WorkspaceInitializer_Empty:
		return visitor(append(path, "empty"), init)
	case *WorkspaceInitializer_Git:
		return visitor(append(path, "git"), init)
	case *WorkspaceInitializer_Snapshot:
		return visitor(append(path, "snapshot"), init)
	case *WorkspaceInitializer_Prebuild:
		child := append(path, "prebuild")
		err := visitor(child, init)
		if err != nil {
			return err
		}
		for i, g := range spec.Prebuild.Git {
			err = WalkInitializer(append(child, strconv.Itoa(i)), &WorkspaceInitializer{Spec: &WorkspaceInitializer_Git{Git: g}}, visitor)
			if err != nil {
				return err
			}
		}
		return nil
	case *WorkspaceInitializer_Composite:
		path = append(path, "composite")
		err := visitor(path, init)
		if err != nil {
			return err
		}
		for i, p := range spec.Composite.Initializer {
			err := WalkInitializer(append(path, strconv.Itoa(i)), p, visitor)
			if err != nil {
				return err
			}
		}
		return nil
	case *WorkspaceInitializer_Download:
		return visitor(append(path, "download"), init)
	case *WorkspaceInitializer_Backup:
		return visitor(append(path, "backup"), init)

	default:
		return fmt.Errorf("unsupported workspace initializer in walkInitializer - this is a bug in Gitpod")
	}
}
