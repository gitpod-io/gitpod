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

package controllers

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/containerd/containerd/remotes/docker"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
	"k8s.io/utils/pointer"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	"github.com/gitpod-io/gitpod/installer/api"
	installer "github.com/gitpod-io/gitpod/installer/api"
	installv1alpha1 "github.com/gitpod-io/gitpod/operator/api/v1alpha1"
)

const (
	installerExecPath = "/tmp/installer.active"
)

// log is for logging in this package.
var installationlog = log.Log.WithName("installation-controller")

// InstallationReconciler reconciles a Installation object
type InstallationReconciler struct {
	DynamicClient dynamic.Interface
	client.Client
	Scheme *runtime.Scheme

	conn          *grpc.ClientConn
	client        installer.InstallerServiceClient
	stopInstaller func() error
}

//+kubebuilder:rbac:groups=install.gitpod.io,resources=installations,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=install.gitpod.io,resources=installations/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=install.gitpod.io,resources=installations/finalizers,verbs=update

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// TODO(user): Modify the Reconcile function to compare the state specified by
// the Installation object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.10.0/pkg/reconcile
func (r *InstallationReconciler) Reconcile(ctx context.Context, req ctrl.Request) (result ctrl.Result, err error) {
	_ = log.FromContext(ctx)

	install := &installv1alpha1.Installation{}
	err = r.Client.Get(ctx, req.NamespacedName, install)
	if err != nil {
		return ctrl.Result{}, err
	}
	status := install.Status
	status.LastUpdated = metav1.Now()

	defer func() {
		install.Status = status
		uerr := r.Status().Update(ctx, install)
		if err == nil && uerr != nil {
			result = ctrl.Result{Requeue: true}
			err = uerr
		}
	}()

	digest, err := resolveInstallerDigest(ctx, install)
	if err != nil {
		return ctrl.Result{Requeue: true}, err
	}

	if digest != install.Status.Digest {
		// we have a new installer version - let's get connected
		installationlog.Info("found new version", "version", digest)

		// try and download the installer
		_, installerfn, err := downloadInstaller(ctx, install)
		if err != nil {
			return ctrl.Result{Requeue: true}, err
		}

		// we might still be connected - if so, stop it all
		if r.conn != nil {
			r.conn.Close()
		}
		r.client = nil
		if r.stopInstaller != nil {
			r.stopInstaller()
		}

		// remove the old installer and move the new one into place
		_ = os.RemoveAll(installerExecPath)
		err = os.Rename(installerfn, installerExecPath)
		if err != nil {
			return ctrl.Result{}, err
		}

		status.Digest = digest
	}

	// if we're not connected, try to connect
	if r.client == nil {
		err = r.runInstaller()
		if err != nil {
			return ctrl.Result{Requeue: true}, err
		}
	}

	if install.Spec.Config == nil {
		return ctrl.Result{}, nil
	}

	cfg, err := json.Marshal(install.Spec.Config)
	if err != nil {
		return ctrl.Result{Requeue: true}, err
	}
	installationlog.Info("validating config", "config", cfg)
	cfgval, err := r.client.ValidateConfig(ctx, &installer.ValidateConfigRequest{Config: cfg})
	if err != nil {
		return ctrl.Result{}, err
	}
	conditions := status.Conditions
	conditions.Config = installv1alpha1.ValidationResult{
		Valid:    cfgval.Valid,
		Warnings: cfgval.Warnings,
		Errors:   cfgval.Errors,
	}
	status.Conditions = conditions

	if !cfgval.Valid {
		return ctrl.Result{}, nil
	}

	rendered, err := r.client.RenderConfig(ctx, &installer.RenderConfigRequest{
		Config:    cfg,
		Namespace: "gitpod",
	})
	if err != nil {
		return ctrl.Result{}, err
	}

	for _, objYAML := range rendered.Resources {
		err = r.applyObj(ctx, []byte(objYAML))
		if err != nil {
			return ctrl.Result{}, err
		}
	}

	return ctrl.Result{RequeueAfter: 24 * time.Hour}, nil
}

func (r *InstallationReconciler) applyObj(ctx context.Context, objYAML []byte) error {
	obj, gvk, err := yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).Decode(objYAML, nil, nil)
	if err != nil {
		return err
	}
	unstructuredMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	unstructuredObj := &unstructured.Unstructured{Object: unstructuredMap}
	b, err := unstructuredObj.MarshalJSON()
	if err != nil {
		return err
	}

	mapping, err := r.Client.RESTMapper().RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		return err
	}

	var dri dynamic.ResourceInterface
	if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
		unstructuredObj.SetNamespace("gitpod")
		dri = r.DynamicClient.Resource(mapping.Resource).Namespace(unstructuredObj.GetNamespace())
	} else {
		dri = r.DynamicClient.Resource(mapping.Resource)
	}

	_, err = dri.Patch(ctx, unstructuredObj.GetName(), types.ApplyPatchType, b, metav1.PatchOptions{
		Force:        pointer.Bool(true),
		FieldManager: "gitpod-operator",
	})
	if err != nil {
		return err
	}
	installationlog.Info("applied object", "name", unstructuredObj.GetName(), "kind", unstructuredObj.GetKind())
	return err
}

func (r *InstallationReconciler) runInstaller() (err error) {
	cmd := exec.Command(installerExecPath, "serve", "--addr", "localhost:9999")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Start()
	if err != nil {
		return
	}

	r.stopInstaller = func() error {
		installationlog.Info("stopping installer")
		err := cmd.Process.Kill()
		r.stopInstaller = nil
		return err
	}
	defer func() {
		if err != nil {
			r.stopInstaller()
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	r.conn, err = grpc.DialContext(ctx, "localhost:9999", grpc.WithInsecure(), grpc.WithBlock())
	if err != nil {
		err = fmt.Errorf("cannot connect to installer: %w", err)
		return
	}
	r.client = api.NewInstallerServiceClient(r.conn)

	return nil
}

func resolveInstallerDigest(ctx context.Context, installation *installv1alpha1.Installation) (digest string, err error) {
	ref := "eu.gcr.io/gitpod-core-dev/build/installer:" + installation.Spec.Channel
	res := docker.NewResolver(docker.ResolverOptions{})
	ref, spec, err := res.Resolve(ctx, ref)
	if err != nil {
		return
	}
	return spec.Digest.String(), nil
}

func downloadInstaller(ctx context.Context, installation *installv1alpha1.Installation) (digest, path string, err error) {
	ref := "eu.gcr.io/gitpod-core-dev/build/installer:" + installation.Spec.Channel
	res := docker.NewResolver(docker.ResolverOptions{})
	ref, spec, err := res.Resolve(ctx, ref)
	if err != nil {
		return
	}
	digest = spec.Digest.String()

	fetcher, err := res.Fetcher(ctx, ref)
	if err != nil {
		return
	}

	var mf ociv1.Manifest
	rc, err := fetcher.Fetch(ctx, spec)
	if err != nil {
		return
	}
	defer rc.Close()
	err = json.NewDecoder(rc).Decode(&mf)
	if err != nil {
		return
	}

	tmpdir, err := ioutil.TempDir("", "installer-*")
	if err != nil {
		return
	}

	lrc, err := fetcher.Fetch(ctx, mf.Layers[len(mf.Layers)-1])
	if err != nil {
		return
	}
	defer lrc.Close()
	compressed, err := gzip.NewReader(lrc)
	if err != nil {
		return
	}
	archive := tar.NewReader(compressed)
	path = filepath.Join(tmpdir, "installer")
	for {
		hdr, err := archive.Next()
		if err != nil {
			return digest, path, err
		}
		if !strings.Contains(hdr.Name, "installer") {
			continue
		}

		f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0755)
		if err != nil {
			return digest, path, err
		}
		defer f.Close()

		_, err = io.Copy(f, io.LimitReader(archive, hdr.Size))
		if err != nil {
			return digest, path, err
		}

		break
	}

	return
}

// SetupWithManager sets up the controller with the Manager.
func (r *InstallationReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&installv1alpha1.Installation{}).
		Complete(r)
}
