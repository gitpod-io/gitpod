// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"strings"

	"github.com/gitpod-io/gitpod/ws-manager/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	"golang.org/x/xerrors"
	"google.golang.org/protobuf/proto"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/pkg/kubeapi/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func newWorkspace(ctx context.Context, cfg *config.Configuration, req *api.StartWorkspaceRequest) (obj *workspacev1.Workspace, err error) {
	workspaceType := strings.ToLower(api.WorkspaceType_name[int32(req.Type)])
	headless := false
	if req.Type != api.WorkspaceType_REGULAR {
		headless = true
	}

	workspaceURL, err := config.RenderWorkspaceURL(cfg.WorkspaceURLTemplate, req.Id, req.ServicePrefix, cfg.GitpodHostURL)
	if err != nil {
		return nil, xerrors.Errorf("cannot get workspace URL: %w", err)
	}

	initCfg, err := proto.Marshal(req.Spec.Initializer)
	if err != nil {
		return nil, xerrors.Errorf("cannot create remarshal initializer: %w", err)
	}

	admissionLevel := workspacev1.AdmissionOwnerOnly
	if req.Spec.Admission == api.AdmissionLevel_ADMIT_EVERYONE {
		admissionLevel = workspacev1.AdmissionEveryone
	}
	ownerToken, err := getRandomString(32)
	if err != nil {
		return nil, xerrors.Errorf("cannot create owner token: %w", err)
	}

	return &workspacev1.Workspace{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Workspace",
			APIVersion: "crd.gitpod.io/v1",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      req.Id,
			Namespace: cfg.Namespace,
			Labels: map[string]string{
				"app":                     "gitpod",
				"gitpod.io/instanceID":    req.Id,
				"gitpod.io/ownerID":       req.Metadata.Owner,
				"gitpod.io/workspaceID":   req.Metadata.MetaId,
				"gitpod.io/workspaceType": workspaceType,
			},
			Annotations: req.Metadata.Annotations,
		},
		Spec: workspacev1.WorkspaceSpec{
			Pod: podName(req.Type, req.Id),
			Metadata: workspacev1.WorkspaceSpecMetadata{
				ServicePrefix: req.ServicePrefix,
				Owner:         req.Metadata.Owner,
				WorkspaceID:   req.Metadata.MetaId,
			},
			Orchestration: workspacev1.WorkspaceSpecOrchestration{
				URL: workspaceURL,
			},
			Workspace: workspacev1.WorkspaceSpecProper{
				WorkspaceImage:    req.Spec.WorkspaceImage,
				IDEImage:          req.Spec.IdeImage,
				Initializer:       []byte(initCfg),
				Env:               getSpecEnvvars(req),
				CheckoutLocation:  req.Spec.CheckoutLocation,
				WorkspaceLocation: req.Spec.WorkspaceLocation,
				Git: &workspacev1.GitSpec{
					Username: req.Spec.Git.Username,
					Email:    req.Spec.Git.Email,
				},
				Timeout: req.Spec.Timeout,
				Auth: workspacev1.AuthSpec{
					Admission:  admissionLevel,
					OwnerToken: ownerToken,
				},
			},
		},
		Status: workspacev1.WorkspaceStatus{
			Headless: headless,
			Phase:    workspacev1.PhasePending,
		},
	}, nil
}

func getSpecEnvvars(req *wsmanapi.StartWorkspaceRequest) (result []corev1.EnvVar) {
	spec := req.Spec

	// User-defined env vars (i.e. those coming from the request)
	if spec.Envvars != nil {
		for _, e := range spec.Envvars {
			if e.Name == "GITPOD_WORKSPACE_CONTEXT" || e.Name == "GITPOD_WORKSPACE_CONTEXT_URL" || e.Name == "GITPOD_TASKS" || e.Name == "GITPOD_RESOLVED_EXTENSIONS" || e.Name == "GITPOD_EXTERNAL_EXTENSIONS" || e.Name == "GITPOD_IDE_ALIAS" {
				result = append(result, corev1.EnvVar{Name: e.Name, Value: e.Value})
				continue
			} else if strings.HasPrefix(e.Name, "GITPOD_") {
				// we don't allow env vars starting with GITPOD_ and those that we do allow we've listed above
				continue
			}

			result = append(result, corev1.EnvVar{Name: e.Name, Value: e.Value})
		}
	}

	// remove empty env vars
	cleanResult := make([]corev1.EnvVar, 0)
	for _, v := range result {
		if v.Name == "" || v.Value == "" {
			continue
		}

		cleanResult = append(cleanResult, v)
	}

	return cleanResult
}

func podName(tpe wsmanapi.WorkspaceType, instanceID string) string {
	var prefix string
	switch tpe {
	case api.WorkspaceType_PREBUILD:
		prefix = "prebuild"
	case api.WorkspaceType_PROBE:
		prefix = "probe"
	case api.WorkspaceType_GHOST:
		prefix = "ghost"
	case api.WorkspaceType_IMAGEBUILD:
		prefix = "imagebuild"
	default:
		prefix = "ws"
	}

	return fmt.Sprintf("%s-%s", prefix, instanceID)
}

// validCookieChars contains all characters which may occur in an HTTP Cookie value (unicode \u0021 through \u007E),
// without the characters , ; and / ... I did not find more details about permissible characters in RFC2965, so I took
// this list of permissible chars from Wikipedia.
//
// The tokens we produce here (e.g. owner token or CLI API token) are likely placed in cookies or transmitted via HTTP.
// To make the lifes of downstream users easier we'll try and play nice here w.r.t. to the characters used.
var validCookieChars = []byte("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-.")

func getRandomString(length int) (string, error) {
	b := make([]byte, length)
	n, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	if n != length {
		return "", io.ErrShortWrite
	}

	lrsc := len(validCookieChars)
	for i, c := range b {
		b[i] = validCookieChars[int(c)%lrsc]
	}
	return string(b), nil
}
