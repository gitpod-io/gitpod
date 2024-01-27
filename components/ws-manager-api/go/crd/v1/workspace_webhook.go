// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1

import (
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

// log is for logging in this package.
var workspacelog = logf.Log.WithName("workspace-resource")

func (r *Workspace) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr).
		For(r).
		Complete()
}

// TODO(user): EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!

//+kubebuilder:webhook:path=/mutate-workspace-gitpod-io-v1-workspace,mutating=true,failurePolicy=fail,sideEffects=None,groups=workspace.gitpod.io,resources=workspaces,verbs=create;update,versions=v1,name=mworkspace.kb.io,admissionReviewVersions=v1

var _ webhook.Defaulter = &Workspace{}

// Default implements webhook.Defaulter so a webhook will be registered for the type
func (r *Workspace) Default() {
	workspacelog.Info("default", "name", r.Name)

	// TODO(user): fill in your defaulting logic.
}

// TODO(user): change verbs to "verbs=create;update;delete" if you want to enable deletion validation.
//+kubebuilder:webhook:path=/validate-workspace-gitpod-io-v1-workspace,mutating=false,failurePolicy=fail,sideEffects=None,groups=workspace.gitpod.io,resources=workspaces,verbs=create;update,versions=v1,name=vworkspace.kb.io,admissionReviewVersions=v1

var _ webhook.Validator = &Workspace{}

// ValidateCreate implements webhook.Validator so a webhook will be registered for the type
func (r *Workspace) ValidateCreate() (admission.Warnings, error) {
	workspacelog.Info("validate create", "name", r.Name)

	return r.validateWorkspace()
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (r *Workspace) ValidateUpdate(old runtime.Object) (admission.Warnings, error) {
	workspacelog.Info("validate update", "name", r.Name)

	return r.validateWorkspace()
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (r *Workspace) ValidateDelete() (admission.Warnings, error) {
	workspacelog.Info("validate delete", "name", r.Name)

	// TODO(user): fill in your validation logic upon object deletion.
	return nil, nil
}

func (r *Workspace) validateWorkspace() (admission.Warnings, error) {
	return nil, nil
}
