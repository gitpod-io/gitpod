/*
Copyright 2022.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

import (
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	ctrl "sigs.k8s.io/controller-runtime"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook"
)

// log is for logging in this package.
var installationlog = logf.Log.WithName("installation-resource")

func (r *Installation) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr).
		For(r).
		Complete()
}

// EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!

//+kubebuilder:webhook:path=/mutate-install-gitpod-io-v1alpha1-installation,mutating=true,failurePolicy=fail,sideEffects=None,groups=install.gitpod.io,resources=installations,verbs=create;update,versions=v1alpha1,name=minstallation.kb.io,admissionReviewVersions=v1

var _ webhook.Defaulter = &Installation{}

// Default implements webhook.Defaulter so a webhook will be registered for the type
func (r *Installation) Default() {
	installationlog.Info("default", "name", r.Name)

	if r.Spec.Channel == "" {
		r.Spec.Channel = "stable"
	}
}

// TODO(user): change verbs to "verbs=create;update;delete" if you want to enable deletion validation.
//+kubebuilder:webhook:path=/validate-install-gitpod-io-v1alpha1-installation,mutating=false,failurePolicy=fail,sideEffects=None,groups=install.gitpod.io,resources=installations,verbs=create;update,versions=v1alpha1,name=vinstallation.kb.io,admissionReviewVersions=v1

var _ webhook.Validator = &Installation{}

// ValidateCreate implements webhook.Validator so a webhook will be registered for the type
func (r *Installation) ValidateCreate() error {
	installationlog.Info("validate create", "name", r.Name)

	return r.validateInstallation()
}

func (r *Installation) validateInstallation() error {
	var allErrs field.ErrorList
	if r.Spec.Channel == "" {
		allErrs = append(allErrs, field.Required(field.NewPath("spec").Child("channel"), "channel is required"))
	}

	return apierrors.NewInvalid(
		schema.GroupKind{Group: "install.gitpod.io", Kind: "Installation"},
		r.Name, allErrs,
	)
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (r *Installation) ValidateUpdate(old runtime.Object) error {
	installationlog.Info("validate update", "name", r.Name)

	return r.validateInstallation()
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (r *Installation) ValidateDelete() error {
	installationlog.Info("validate delete", "name", r.Name)

	// TODO(user): fill in your validation logic upon object deletion.
	return nil
}
