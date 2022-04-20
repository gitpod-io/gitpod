// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
)

var filterCmd = &cobra.Command{
	Use:   "filter",
	Short: "",
	Args:  cobra.ExactArgs(0),
	Run: func(_ *cobra.Command, args []string) {
		objs, err := parseAsJsonArray()
		if err != nil {
			log.Panic(err)
		}

		// sort by .kind and .metadata.name
		sort.SliceStable(objs, func(i, j int) bool {
			id := func(i int) string {
				return fmt.Sprintf("%s:%s", objs[i].GetKind(), objs[i].GetName())
			}
			return id(i) < id(j)
		})

		var outObjs []unstructured.Unstructured
		for _, obj := range objs {
			// filter out generic stuff: .status, .metadata.annotations, etc.
			err = filterGenericStuff(&obj)
			if err != nil {
				log.Panic(err)
			}

			// handle specific objects
			filter, err := filterSpecificObjects(&obj)
			if err != nil {
				log.Panic(err)
			}
			if filter {
				outObjs = append(outObjs, obj)
			}
		}

		// pretty print to stdout
		bytes, err := json.MarshalIndent(outObjs, "", "  ")
		if err != nil {
			log.Panic(fmt.Errorf("unable to print output: %w", err))
		}
		fmt.Print(string(bytes))
	},
}

func parseAsJsonArray() (objs []unstructured.Unstructured, err error) {
	inBytes, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		log.Fatalf("failed to read stdin: %s", err)
	}

	err = json.Unmarshal(inBytes, &objs)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal json: %w", err)
	}
	return objs, nil
}

var emptyMap = map[string]string{}

func filterGenericStuff(obj *unstructured.Unstructured) (err error) {

	// filter all kind of labels, and other type-specific stuff
	obj.SetLabels(filterLabels(obj.GetLabels()))
	switch obj.GetKind() {
	case "Service":
		svc := asService(obj)
		svc.Spec.Selector = filterLabels(svc.Spec.Selector)
		svc.Spec.SessionAffinity = "" // gpl: new relies on k8s default ("None"), old always sets "None" everywhere
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(svc)
	case "Deployment":
		dep := asDeployment(obj)
		dep.Spec.Selector.MatchLabels = filterLabels(dep.Spec.Selector.MatchLabels)
		dep.Spec.Template.ObjectMeta.Labels = filterLabels(dep.Spec.Template.ObjectMeta.Labels)
		dep.Spec.Template.ObjectMeta.Annotations = nil
		dep.Spec.Template.ObjectMeta.Namespace = ""
		dep.Spec.Template.ObjectMeta.CreationTimestamp = v1.Time{}
		dep.Spec.Template.CreationTimestamp = v1.Time{}
		dep.Spec.Template.Spec.ImagePullSecrets = nil
		dep.Spec.Template.Spec.EnableServiceLinks = nil
		sortContainersAndEnvVars(dep.Spec.Template.Spec.Containers)
		sortContainersAndEnvVars(dep.Spec.Template.Spec.InitContainers)
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(dep)
	case "StatefulSet":
		sts := asStatefulSet(obj)
		sts.Spec.Selector.MatchLabels = filterLabels(sts.Spec.Selector.MatchLabels)
		sts.Spec.Template.ObjectMeta.Labels = filterLabels(sts.Spec.Template.ObjectMeta.Labels)
		sts.Spec.Template.ObjectMeta.Annotations = nil
		sts.Spec.Template.ObjectMeta.Namespace = ""
		sts.Spec.Template.ObjectMeta.CreationTimestamp = v1.Time{}
		sts.Spec.Template.CreationTimestamp = v1.Time{}
		sts.Spec.Template.Spec.ImagePullSecrets = nil
		sts.Spec.Template.Spec.EnableServiceLinks = nil
		sortContainersAndEnvVars(sts.Spec.Template.Spec.Containers)
		sortContainersAndEnvVars(sts.Spec.Template.Spec.InitContainers)
		for i, vct := range sts.Spec.VolumeClaimTemplates {
			sts.Spec.VolumeClaimTemplates[i].ObjectMeta.Labels = filterLabels(vct.ObjectMeta.Labels)
		}
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(sts)
	case "ClusterRole":
		cr := asClusterRole(obj)
		cr.SetLabels(emptyMap)
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(cr)
	}

	// no .metadata.*
	// (needs to be below the kind-specific stuff to override converter artifacts!)
	obj.SetAnnotations(emptyMap)
	obj.SetNamespace("")
	obj.SetCreationTimestamp(v1.Time{})	// results in "null". How to set to "nil" w/o writing by hand?

	delete(obj.Object, "status")
	delete(obj.Object, "automountServiceAccountToken")
	delete(obj.Object, "imagePullSecrets")

	return err
}

func filterLabels(lbls map[string]string) map[string]string {
	res := map[string]string{}
	for k, v := range lbls {
		switch {
		case k == "stage":
			continue
		case k == "kind":
			continue
		case k == "chart":
			continue
		case k == "heritage":
			continue
		case k == "release":
			continue
		case strings.HasPrefix(k, "helm.sh/"):
			continue
		case strings.HasPrefix(k, "app.kubernetes.io/"):
			continue
		}
		res[k] = v
	}
	return res
}

func sortContainersAndEnvVars(containers []corev1.Container) {
	sort.SliceStable(containers, func(i, j int) bool {
		return containers[i].Name < containers[j].Name
	})

	for _, container := range containers {
		env := container.Env
		sort.SliceStable(env, func(i, j int) bool {
			return env[i].Name < env[j].Name
		})
	}
}

func filterSpecificObjects(obj *unstructured.Unstructured) (filter bool, err error) {
	// TODO(gpl) revise later: generic
	switch obj.GetKind() {
	case "Certificate", "ClusterRole", "ClusterRoleBinding", "RoleBinding", "Role":
		return false, nil
	}

	// TODO(gpl) revise later: NetworkPolicy
	switch obj.GetKind() {
	case "NetworkPolicy":
		return false, nil
	}

	// TODO(gpl) revise later: workspace stack
	switch obj.GetLabels()["component"] {
	case "agent-smith", "ws-daemon", "registry-facade", "ws-manager", "blobserve", "image-builder-mk3", "ws-proxy", "workspace":
		return false, nil
	}
	switch obj.GetName() {
	case "blobserve-config", "image-builder-mk3-config", "default-ns-registry-facade":
		return false, nil
	}

	// TODO(gpl) revise later: messagebus, db-sync, payment-endpoint, dbinit, migrations
	switch obj.GetLabels()["component"] {
	case "messagebus", "db-sync", "payment-endpoint", "dbinit", "migrations":
		return false, nil
	}

	// filter/format individual fields
	id := fmt.Sprintf("%s:%s", obj.GetKind(), obj.GetName())
	switch id {
	case "ConfigMap:content-service-config", "ConfigMap:content-service", "ConfigMap:server-config":
		cm := asConfigMap(obj)
		prettyPrintMapJsonValues(cm.Data, "config.json")
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(cm)
	case "ConfigMap:image-builder-mk3-config":
		cm := asConfigMap(obj)
		prettyPrintMapJsonValues(cm.Data, "image-builder.json")
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(cm)
	case "ConfigMap:ws-manager-bridge-config":
		cm := asConfigMap(obj)
		prettyPrintMapJsonValues(cm.Data, "ws-manager-bridge.json")
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(cm)
	case "ConfigMap:ws-manager-config":
		cm := asConfigMap(obj)
		prettyPrintMapJsonValues(cm.Data, "config.json")
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(cm)
	case "ConfigMap:server-ide-config":
		cm := asConfigMap(obj)
		prettyPrintMapJsonValues(cm.Data, "config.json")
		obj.Object, err = runtime.DefaultUnstructuredConverter.ToUnstructured(cm)

	// ignore installer-specific things
	case "ConfigMap:gitpod", "ConfigMap:gitpod-app", "CronJob:gitpod-telemetry":
		return false, nil
	}

	// deprecate "restarter", "kedge", applitools
	switch obj.GetLabels()["component"] {
	case "restarter", "kedge":
		return false, nil
	}
	switch obj.GetName() {
	case "workspace-applitools":
		return false, nil
	}

	return true, err
}

func asDeployment(obj *unstructured.Unstructured) *appsv1.Deployment {
	dep := appsv1.Deployment{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &dep)
	assertNoError(err)
	return &dep
}

func asStatefulSet(obj *unstructured.Unstructured) *appsv1.StatefulSet {
	sts := appsv1.StatefulSet{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &sts)
	assertNoError(err)
	return &sts
}

func asService(obj *unstructured.Unstructured) *corev1.Service {
	svc := corev1.Service{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &svc)
	assertNoError(err)
	return &svc
}

func asClusterRole(obj *unstructured.Unstructured) *rbacv1.ClusterRole {
	cr := rbacv1.ClusterRole{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &cr)
	assertNoError(err)
	return &cr
}

func asConfigMap(obj *unstructured.Unstructured) *corev1.ConfigMap {
	cm := corev1.ConfigMap{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &cm)
	assertNoError(err)
	return &cm
}

func prettyPrintJsonString(s string) string {
	var v interface{}
	err := json.Unmarshal([]byte(s), &v)
	assertNoError(err)
	b, err := json.MarshalIndent(v, "", " ")
	assertNoError(err)
	return string(b)
}

func prettyPrintMapJsonValues(m map[string]string, ks ...string) {
	for _, k := range ks {
		m[k] = prettyPrintJsonString(m[k])
	}
}

func assertNoError(err error) {
	if err != nil {
		panic(err)
	}
}

func init() {
	rootCmd.AddCommand(filterCmd)
}
