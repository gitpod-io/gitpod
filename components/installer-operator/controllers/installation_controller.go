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
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/containerd/containerd/remotes/docker"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	goyaml "gopkg.in/yaml.v2"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/dynamic"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	installv1alpha1 "github.com/gitpod-io/gitpod/operator/api/v1alpha1"
)

// InstallationReconciler reconciles a Installation object
type InstallationReconciler struct {
	client.Client
	Scheme *runtime.Scheme
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
func (r *InstallationReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	_ = log.FromContext(ctx)

	install := &installv1alpha1.Installation{}
	err := r.Client.Get(ctx, req.NamespacedName, install)
	if err != nil {
		return ctrl.Result{}, err
	}

	// try and download the installer
	digest, installerfn, err := downloadInstaller(ctx, install)
	if err != nil {
		return ctrl.Result{}, err
	}

	cfgfn, err := writeConfig(filepath.Dir(installerfn), install)
	if err != nil {
		return ctrl.Result{}, err
	}

	err = applyConfig(ctx, installerfn, cfgfn)
	if err != nil {
		return ctrl.Result{}, err
	}

	install.Status.Digest = digest

	err = r.Status().Update(ctx, install)
	if err != nil {
		return ctrl.Result{Requeue: true}, err
	}

	return ctrl.Result{RequeueAfter: 24 * time.Hour}, nil
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

func writeConfig(dir string, installation *installv1alpha1.Installation) (string, error) {
	cfg, err := goyaml.Marshal(installation.Spec.Config)
	if err != nil {
		return "", err
	}
	cfgfn := filepath.Join(dir, "config.yaml")
	err = ioutil.WriteFile(cfgfn, cfg, 0644)
	if err != nil {
		return "", err
	}
	return cfgfn, nil
}

func applyConfig(ctx context.Context, installer, config string) error {
	buf := bytes.NewBuffer(nil)
	cmd := exec.Command(installer, "render", "--config", config, "--namespace", "gitpod")
	cmd.Stdout = buf
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		return err
	}

	// create the dynamic client from kubeconfig
	dynamicClient, err := dynamic.NewForConfig(ctrl.GetConfigOrDie())
	if err != nil {
		return err
	}

	yr := yaml.NewYAMLReader(bufio.NewReader(buf))

	// read returns a complete YAML document.
	for {
		buf, err := yr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		// Do not use this YAML doc if it is unkind.
		var typeMeta runtime.TypeMeta
		if err := yaml.Unmarshal(buf, &typeMeta); err != nil {
			continue
		}
		if typeMeta.Kind == "" {
			continue
		}

		// Define the unstructured object into which the YAML document will be
		// unmarshaled.
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{},
		}

		// Unmarshal the YAML document into the unstructured object.
		err = yaml.Unmarshal(buf, &obj.Object)
		if err != nil {
			return err
		}

		// create the object using the dynamic client
		nodeResource := schema.GroupVersionResource{Version: "v1", Resource: "Node"}
		_, err = dynamicClient.Resource(nodeResource).Namespace("gitpod").Create(ctx, obj, v1.CreateOptions{})
		if err != nil {
			return err
		}
	}

	return nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *InstallationReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&installv1alpha1.Installation{}).
		Complete(r)
}
