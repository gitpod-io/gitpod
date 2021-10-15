// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/pkg/kubeapi/v1"

	"github.com/imdario/mergo"
	"golang.org/x/xerrors"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

const (
	// workspaceVolume is the name of the workspace volume
	workspaceVolumeName = "workspace-content"
	// workspaceDir is the path within all containers where workspaceVolume is mounted to
	workspaceDir = "/workspace"
	// MarkerLabel is the label by which we identify pods which belong to ws-manager
	markerLabel = "gitpod.io/ws-manager-ii"
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
				Type:              workspacev1.WorkspaceType(workspaceType),
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

func podName(tpe workspacev1.WorkspaceType, instanceID string) string {
	var prefix string
	switch tpe {
	case workspacev1.WorkspaceTypePrebuild:
		prefix = "prebuild"
	case workspacev1.WorkspaceTypeProbe:
		prefix = "probe"
	case workspacev1.WorkspaceTypeGhost:
		prefix = "ghost"
	case workspacev1.WorkspaceTypeImageBuild:
		prefix = "imagebuild"
	default:
		prefix = "ws"
	}

	return fmt.Sprintf("%s-%s", prefix, instanceID)
}

type WorkspaceCreator struct {
	Config *config.Configuration
}

// createWorkspacePod creates the actual workspace pod based on the definite workspace pod and appropriate
// templates. The result of this function is not expected to be modified prior to being passed to Kubernetes.
func (wc *WorkspaceCreator) createWorkspacePod(ws *workspacev1.Workspace) (*corev1.Pod, error) {
	podTemplate, err := config.GetWorkspacePodTemplate(wc.Config.WorkspacePodTemplate.DefaultPath)
	if err != nil {
		return nil, xerrors.Errorf("cannot read pod template - this is a configuration problem: %w", err)
	}
	var typeSpecificTpl *corev1.Pod
	switch ws.Spec.Workspace.Type {
	case workspacev1.WorkspaceTypeRegular:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(wc.Config.WorkspacePodTemplate.RegularPath)
	case workspacev1.WorkspaceTypePrebuild:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(wc.Config.WorkspacePodTemplate.PrebuildPath)
	case workspacev1.WorkspaceTypeProbe:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(wc.Config.WorkspacePodTemplate.ProbePath)
	case workspacev1.WorkspaceTypeGhost:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(wc.Config.WorkspacePodTemplate.GhostPath)
	case workspacev1.WorkspaceTypeImageBuild:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(wc.Config.WorkspacePodTemplate.ImagebuildPath)
	}
	if err != nil {
		return nil, xerrors.Errorf("cannot read type-specific pod template - this is a configuration problem: %w", err)
	}
	if typeSpecificTpl != nil {
		err = combineDefiniteWorkspacePodWithTemplate(podTemplate, typeSpecificTpl)
		if err != nil {
			return nil, xerrors.Errorf("cannot apply type-specific pod template: %w", err)
		}
	}

	pod, err := wc.createDefiniteWorkspacePod(ws)
	if err != nil {
		return nil, xerrors.Errorf("cannot create definite workspace pod: %w", err)
	}
	err = combineDefiniteWorkspacePodWithTemplate(pod, podTemplate)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace pod: %w", err)
	}
	return pod, nil
}

// combineDefiniteWorkspacePodWithTemplate merges a definite workspace pod with a user-provided template.
// In essence this function just calls mergo, but we need to make sure we use the right flags (and that we can test the right flags).
func combineDefiniteWorkspacePodWithTemplate(pod *corev1.Pod, template *corev1.Pod) error {
	if template == nil {
		return nil
	}
	if pod == nil {
		return xerrors.Errorf("definite pod cannot be nil")
	}

	err := mergo.Merge(pod, template, mergo.WithAppendSlice, mergo.WithTransformers(&mergePodTransformer{}))
	if err != nil {
		return xerrors.Errorf("cannot merge workspace pod with template: %w", err)
	}

	return nil
}

// mergePodTransformer is a mergo transformer which facilitates merging of NodeAffinity and containers
type mergePodTransformer struct{}

func (*mergePodTransformer) Transformer(typ reflect.Type) func(dst, src reflect.Value) error {
	switch typ {
	case reflect.TypeOf([]corev1.NodeSelectorTerm{}):
		return mergeNodeAffinityMatchExpressions
	case reflect.TypeOf([]corev1.Container{}):
		return mergeContainer
	case reflect.TypeOf(&corev1.Probe{}):
		return mergeProbe
	}

	return nil
}

// mergeContainer merges cnotainers by name
func mergeContainer(dst, src reflect.Value) (err error) {
	// working with reflection is tricky business - add a safety net here and recover if things go sideways
	defer func() {
		r := recover()
		if er, ok := r.(error); r != nil && ok {
			err = er
		}
	}()

	if !dst.CanSet() || !src.CanSet() {
		return nil
	}

	srcs := src.Interface().([]corev1.Container)
	dsts := dst.Interface().([]corev1.Container)

	for _, s := range srcs {
		di := -1
		for i, d := range dsts {
			if d.Name == s.Name {
				di = i
				break
			}
		}
		if di < 0 {
			// We don't have a matching destination container to merge this src one into
			continue
		}

		err = mergo.Merge(&dsts[di], s, mergo.WithAppendSlice, mergo.WithOverride, mergo.WithTransformers(&mergePodTransformer{}))
		if err != nil {
			return err
		}
	}

	dst.Set(reflect.ValueOf(dsts))
	return nil
}

// mergeNodeAffinityMatchExpressions ensures that NodeAffinityare AND'ed
func mergeNodeAffinityMatchExpressions(dst, src reflect.Value) (err error) {
	// working with reflection is tricky business - add a safety net here and recover if things go sideways
	defer func() {
		r := recover()
		if er, ok := r.(error); r != nil && ok {
			err = er
		}
	}()

	if !dst.CanSet() || !src.CanSet() {
		return nil
	}

	srcs := src.Interface().([]corev1.NodeSelectorTerm)
	dsts := dst.Interface().([]corev1.NodeSelectorTerm)

	if len(dsts) > 1 {
		// we only run this mechanism if it's clear where we merge into
		return nil
	}
	if len(dsts) == 0 {
		dsts = srcs
	} else {
		for _, term := range srcs {
			dsts[0].MatchExpressions = append(dsts[0].MatchExpressions, term.MatchExpressions...)
		}
	}
	dst.Set(reflect.ValueOf(dsts))

	return nil
}

func mergeProbe(dst, src reflect.Value) (err error) {
	// working with reflection is tricky business - add a safety net here and recover if things go sideways
	defer func() {
		r := recover()
		if er, ok := r.(error); r != nil && ok {
			err = er
		}
	}()

	srcs := src.Interface().(*corev1.Probe)
	dsts := dst.Interface().(*corev1.Probe)

	if dsts != nil && srcs == nil {
		// don't overwrite with nil
	} else if dsts == nil && srcs != nil {
		// we don't have anything at dst yet - take the whole src
		*dsts = *srcs
	} else {
		dsts.HTTPGet = srcs.HTTPGet
		dsts.Exec = srcs.Exec
		dsts.TCPSocket = srcs.TCPSocket
	}

	// *srcs = *dsts
	return nil
}

// createDefiniteWorkspacePod creates a workspace pod without regard for any template.
// The result of this function can be deployed and it would work.
func (wc *WorkspaceCreator) createDefiniteWorkspacePod(ws *workspacev1.Workspace) (*corev1.Pod, error) {
	workspaceContainer, err := wc.createWorkspaceContainer(ws)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace container: %w", err)
	}

	// Beware: this allows setuid binaries in the workspace - supervisor needs to set no_new_privs now.
	// However: the whole user workload now runs in a user namespace, which makes this acceptable.
	workspaceContainer.SecurityContext.AllowPrivilegeEscalation = pointer.Bool(true)

	workspaceVolume, err := wc.createWorkspaceVolumes(ws)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace volumes: %w", err)
	}

	labels := make(map[string]string)
	labels["gitpod.io/networkpolicy"] = "default"
	for k, v := range ws.ObjectMeta.Labels {
		labels[k] = v
	}

	annotations := map[string]string{
		"prometheus.io/scrape":               "true",
		"prometheus.io/path":                 "/metrics",
		"prometheus.io/port":                 strconv.Itoa(int(22999)),
		wsk8s.RequiredNodeServicesAnnotation: "ws-daemon,registry-facade",
		// TODO(cw): post Kubernetes 1.19 use GA form for settings those profiles
		"container.apparmor.security.beta.kubernetes.io/workspace": "unconfined",
		// We're using a custom seccomp profile for user namespaces to allow clone, mount and chroot.
		// Those syscalls don't make much sense in a non-userns setting, where we default to runtime/default using the PodSecurityPolicy.
		"seccomp.security.alpha.kubernetes.io/pod": wc.Config.SeccompProfile,
		// prevent cluster-autoscaler from removing a node
		// https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node
		"cluster-autoscaler.kubernetes.io/safe-to-evict": "false",
	}

	// By default we embue our workspace pods with some tolerance towards pressure taints,
	// see https://kubernetes.io/docs/concepts/configuration/taint-and-toleration/#taint-based-evictions
	// for more details. As hope/assume that the pressure might go away in this time.
	// Memory and Disk pressure are no reason to stop a workspace - instead of stopping a workspace
	// we'd rather wait things out or gracefully fail the workspace ourselves.
	var perssureToleranceSeconds int64 = 30

	// Mounting /dev/net/tun should be fine security-wise, because:
	//   - the TAP driver documentation says so (see https://www.kernel.org/doc/Documentation/networking/tuntap.txt)
	//   - systemd's nspawn does the same thing (if it's good enough for them, it's good enough for us)
	var (
		hostPathOrCreate = corev1.HostPathDirectoryOrCreate
		daemonVolumeName = "daemon-mount"
	)

	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        podName(ws.Spec.Workspace.Type, ws.Name),
			Namespace:   wc.Config.Namespace,
			Labels:      labels,
			Annotations: annotations,
		},
		Spec: corev1.PodSpec{
			AutomountServiceAccountToken: pointer.Bool(false),
			ServiceAccountName:           "workspace",
			SchedulerName:                wc.Config.SchedulerName,
			EnableServiceLinks:           pointer.Bool(false),
			Containers: []corev1.Container{
				*workspaceContainer,
			},
			RestartPolicy: corev1.RestartPolicyNever,
			Volumes: []corev1.Volume{
				workspaceVolume,
				{
					Name: daemonVolumeName,
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: filepath.Join(wc.Config.WorkspaceHostPath, ws.Name+"-daemon"),
							Type: &hostPathOrCreate,
						},
					},
				},
			},
			Tolerations: []corev1.Toleration{
				{
					Key:      "node.kubernetes.io/disk-pressure",
					Operator: "Exists",
					Effect:   "NoExecute",
					// Tolarate Indefinitely
				},
				{
					Key:      "node.kubernetes.io/memory-pressure",
					Operator: "Exists",
					Effect:   "NoExecute",
					// Tolarate Indefinitely
				},
				{
					Key:               "node.kubernetes.io/network-unavailable",
					Operator:          "Exists",
					Effect:            "NoExecute",
					TolerationSeconds: &perssureToleranceSeconds,
				},
			},
		},
	}

	// ffidx := make(map[api.WorkspaceFeatureFlag]struct{})
	// for _, feature := range startContext.Request.Spec.FeatureFlags {
	// 	if _, seen := ffidx[feature]; seen {
	// 		continue
	// 	}
	// 	ffidx[feature] = struct{}{}

	// 	switch feature {
	// 	case api.WorkspaceFeatureFlag_FULL_WORKSPACE_BACKUP:
	// 		removeVolume(&pod, workspaceVolumeName)
	// 		pod.Labels[fullWorkspaceBackupAnnotation] = "true"
	// 		pod.Annotations[fullWorkspaceBackupAnnotation] = "true"

	// 	case api.WorkspaceFeatureFlag_FIXED_RESOURCES:
	// 		var cpuLimit string
	// 		for _, c := range pod.Spec.Containers {
	// 			if c.Name != "workspace" {
	// 				continue
	// 			}
	// 			cpuLimit = c.Resources.Limits.Cpu().String()
	// 		}
	// 		pod.Annotations[wsk8s.CPULimitAnnotation] = cpuLimit

	// 	case api.WorkspaceFeatureFlag_NOOP:

	// 	default:
	// 		return nil, xerrors.Errorf("unknown feature flag: %v", feature)
	// 	}
	// }

	return &pod, nil
}

// func removeVolume(pod *corev1.Pod, name string) {
// 	var vols []corev1.Volume
// 	for _, v := range pod.Spec.Volumes {
// 		if v.Name == name {
// 			continue
// 		}
// 		vols = append(vols, v)
// 	}
// 	pod.Spec.Volumes = vols

// 	for i, c := range pod.Spec.Containers {
// 		var mounts []corev1.VolumeMount
// 		for _, v := range c.VolumeMounts {
// 			if v.Name == name {
// 				continue
// 			}
// 			mounts = append(mounts, v)
// 		}
// 		pod.Spec.Containers[i].VolumeMounts = mounts
// 	}
// }

func (wc *WorkspaceCreator) createWorkspaceContainer(ws *workspacev1.Workspace) (*corev1.Container, error) {
	limits, err := wc.Config.Container.Workspace.Limits.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspace container limits: %w", err)
	}
	requests, err := wc.Config.Container.Workspace.Requests.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspace container requests: %w", err)
	}
	env, err := wc.createWorkspaceEnvironment(ws)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace env: %w", err)
	}
	sec, err := wc.createDefaultSecurityContext()
	if err != nil {
		return nil, xerrors.Errorf("cannot create Theia env: %w", err)
	}
	mountPropagation := corev1.MountPropagationHostToContainer

	var (
		command        = []string{"/.supervisor/workspacekit", "ring0"}
		readinessProbe = &corev1.Probe{
			Handler: corev1.Handler{
				HTTPGet: &corev1.HTTPGetAction{
					Path:   "/_supervisor/v1/status/content/wait/true",
					Port:   intstr.FromInt(22999),
					Scheme: corev1.URISchemeHTTP,
				},
			},
			// We make the readiness probe more difficult to fail than the liveness probe.
			// This way, if the workspace really has a problem it will be shut down by Kubernetes rather than end up in
			// some undefined state.
			FailureThreshold:    600,
			PeriodSeconds:       1,
			SuccessThreshold:    1,
			TimeoutSeconds:      1,
			InitialDelaySeconds: 4,
		}
	)

	if ws.Spec.Workspace.Type == workspacev1.WorkspaceTypeGhost {
		command = []string{"/.supervisor/supervisor", "ghost"}
		readinessProbe = nil
	}

	image := fmt.Sprintf("%s/%s/%s", wc.Config.RegistryFacadeHost, regapi.ProviderPrefixRemote, ws.Name)

	return &corev1.Container{
		Name:            "workspace",
		Image:           image,
		SecurityContext: sec,
		ImagePullPolicy: corev1.PullIfNotPresent,
		Ports: []corev1.ContainerPort{
			{ContainerPort: 23000},
		},
		Resources: corev1.ResourceRequirements{
			Limits:   limits,
			Requests: requests,
		},
		VolumeMounts: []corev1.VolumeMount{
			{
				Name:             workspaceVolumeName,
				MountPath:        workspaceDir,
				ReadOnly:         false,
				MountPropagation: &mountPropagation,
			},
			{
				MountPath:        "/.workspace",
				Name:             "daemon-mount",
				MountPropagation: &mountPropagation,
			},
		},
		ReadinessProbe:           readinessProbe,
		Env:                      env,
		Command:                  command,
		TerminationMessagePolicy: corev1.TerminationMessageReadFile,
	}, nil
}

func (wc *WorkspaceCreator) createWorkspaceEnvironment(ws *workspacev1.Workspace) ([]corev1.EnvVar, error) {
	getWorkspaceRelativePath := func(segment string) string {
		return filepath.Join("/workspace", segment)
	}

	// Envs that start with GITPOD_ are appended to the Terminal environments
	result := []corev1.EnvVar{}
	result = append(result, corev1.EnvVar{Name: "GITPOD_REPO_ROOT", Value: getWorkspaceRelativePath(ws.Spec.Workspace.CheckoutLocation)})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_ID", Value: ws.Spec.Metadata.WorkspaceID})
	result = append(result, corev1.EnvVar{Name: "GITPOD_INSTANCE_ID", Value: ws.Name})
	result = append(result, corev1.EnvVar{Name: "GITPOD_THEIA_PORT", Value: strconv.Itoa(23000)})
	result = append(result, corev1.EnvVar{Name: "THEIA_WORKSPACE_ROOT", Value: getWorkspaceRelativePath(ws.Spec.Workspace.WorkspaceLocation)})
	result = append(result, corev1.EnvVar{Name: "GITPOD_HOST", Value: wc.Config.GitpodHostURL})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_URL", Value: ws.Spec.Orchestration.URL})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_CLUSTER_HOST", Value: wc.Config.WorkspaceClusterHost})
	result = append(result, corev1.EnvVar{Name: "THEIA_SUPERVISOR_ENDPOINT", Value: fmt.Sprintf(":%d", 22999)})
	// TODO(ak) remove THEIA_WEBVIEW_EXTERNAL_ENDPOINT and THEIA_MINI_BROWSER_HOST_PATTERN when Theia is removed
	result = append(result, corev1.EnvVar{Name: "THEIA_WEBVIEW_EXTERNAL_ENDPOINT", Value: "webview-{{hostname}}"})
	result = append(result, corev1.EnvVar{Name: "THEIA_MINI_BROWSER_HOST_PATTERN", Value: "browser-{{hostname}}"})

	// We don't require that Git be configured for workspaces
	if git := ws.Spec.Workspace.Git; git != nil {
		result = append(result, corev1.EnvVar{Name: "GITPOD_GIT_USER_NAME", Value: git.Username})
		result = append(result, corev1.EnvVar{Name: "GITPOD_GIT_USER_EMAIL", Value: git.Email})
	}

	// User-defined env vars (i.e. those coming from the request)
	for _, e := range ws.Spec.Workspace.Env {
		if e.Name == "GITPOD_WORKSPACE_CONTEXT" || e.Name == "GITPOD_WORKSPACE_CONTEXT_URL" || e.Name == "GITPOD_TASKS" || e.Name == "GITPOD_RESOLVED_EXTENSIONS" || e.Name == "GITPOD_EXTERNAL_EXTENSIONS" || e.Name == "GITPOD_IDE_ALIAS" {
			result = append(result, corev1.EnvVar{Name: e.Name, Value: e.Value})
			continue
		} else if strings.HasPrefix(e.Name, "GITPOD_") {
			// we don't allow env vars starting with GITPOD_ and those that we do allow we've listed above
			continue
		}

		result = append(result, corev1.EnvVar{Name: e.Name, Value: e.Value})
	}

	heartbeatInterval := time.Duration(wc.Config.HeartbeatInterval)
	result = append(result, corev1.EnvVar{Name: "GITPOD_INTERVAL", Value: fmt.Sprintf("%d", int64(heartbeatInterval/time.Millisecond))})

	res, err := wc.Config.Container.Workspace.Requests.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot create environment: %w", err)
	}
	memoryInMegabyte := res.Memory().Value() / (1000 * 1000)
	result = append(result, corev1.EnvVar{Name: "GITPOD_MEMORY", Value: strconv.FormatInt(memoryInMegabyte, 10)})

	if ws.Status.Headless {
		result = append(result, corev1.EnvVar{Name: "GITPOD_HEADLESS", Value: "true"})
	}

	// remove empty env vars
	cleanResult := make([]corev1.EnvVar, 0)
	for _, v := range result {
		if v.Name == "" || v.Value == "" {
			continue
		}

		cleanResult = append(cleanResult, v)
	}

	return cleanResult, nil
}

func (wc *WorkspaceCreator) createWorkspaceVolumes(ws *workspacev1.Workspace) (workspace corev1.Volume, err error) {
	// silly protobuf structure design - this needs to be a reference to a string,
	// so we have to assign it to a variable first to take the address
	hostPathOrCreate := corev1.HostPathDirectoryOrCreate

	workspace = corev1.Volume{
		Name: workspaceVolumeName,
		VolumeSource: corev1.VolumeSource{
			HostPath: &corev1.HostPathVolumeSource{
				Path: filepath.Join(wc.Config.WorkspaceHostPath, ws.Name),
				Type: &hostPathOrCreate,
			},
		},
	}

	err = nil
	return
}

func (wc *WorkspaceCreator) createDefaultSecurityContext() (*corev1.SecurityContext, error) {
	gitpodGUID := int64(33333)

	res := &corev1.SecurityContext{
		AllowPrivilegeEscalation: pointer.Bool(false),
		Capabilities: &corev1.Capabilities{
			Add: []corev1.Capability{
				"AUDIT_WRITE",      // Write records to kernel auditing log.
				"FSETID",           // Don’t clear set-user-ID and set-group-ID permission bits when a file is modified.
				"KILL",             // Bypass permission checks for sending signals.
				"NET_BIND_SERVICE", // Bind a socket to internet domain privileged ports (port numbers less than 1024).
				"SYS_PTRACE",       // Trace arbitrary processes using ptrace(2).
			},
			Drop: []corev1.Capability{
				"SETPCAP",      // Modify process capabilities.
				"CHOWN",        // Make arbitrary changes to file UIDs and GIDs (see chown(2)).
				"NET_RAW",      // Use RAW and PACKET sockets.
				"DAC_OVERRIDE", // Bypass file read, write, and execute permission checks.
				"FOWNER",       // Bypass permission checks on operations that normally require the file system UID of the process to match the UID of the file.
				"SYS_CHROOT",   // Use chroot(2), change root directory.
				"SETFCAP",      // Set file capabilities.
				"SETUID",       // Make arbitrary manipulations of process UIDs.
				"SETGID",       // Make arbitrary manipulations of process GIDs and supplementary GID list.
			},
		},
		Privileged:             pointer.Bool(false),
		ReadOnlyRootFilesystem: pointer.Bool(false),
		RunAsGroup:             &gitpodGUID,
		RunAsNonRoot:           pointer.Bool(true),
		RunAsUser:              &gitpodGUID,
	}

	return res, nil
}

// func (wc *WorkspaceCreator) createPortsService(instanceID string, workspaceID string, servicePrefix string, ports []*api.PortSpec) (*corev1.Service, error) {
// 	annotations := make(map[string]string)

// 	// create service ports
// 	servicePorts := make([]corev1.ServicePort, len(ports))
// 	for i, p := range ports {
// 		servicePorts[i] = corev1.ServicePort{
// 			Port:     int32(p.Port),
// 			Protocol: corev1.ProtocolTCP,
// 		}
// 		if p.Target != 0 {
// 			servicePorts[i].TargetPort = intstr.FromInt(int(p.Target))
// 		}

// 		url, err := config.RenderWorkspacePortURL(wc.Config.WorkspacePortURLTemplate, config.PortURLContext{
// 			Host:          wc.Config.GitpodHostURL,
// 			ID:            workspaceID,
// 			IngressPort:   fmt.Sprint(p.Port),
// 			Prefix:        servicePrefix,
// 			WorkspacePort: fmt.Sprint(p.Port),
// 		})
// 		if err != nil {
// 			return nil, xerrors.Errorf("cannot render public URL for %d: %w", p.Port, err)
// 		}
// 		annotations[fmt.Sprintf("gitpod/port-url-%d", p.Port)] = url
// 	}

// 	serviceName := getPortsServiceName(servicePrefix)
// 	return &corev1.Service{
// 		ObjectMeta: metav1.ObjectMeta{
// 			Name:      serviceName,
// 			Namespace: wc.Config.Namespace,
// 			Labels: map[string]string{
// 				"gitpod.io/instanceID":  instanceID,
// 				"gitpod.io/workspaceID": workspaceID,
// 				markerLabel:             "true",
// 				wsk8s.ServiceTypeLabel:  "ports",
// 			},
// 			Annotations: annotations,
// 		},
// 		Spec: corev1.ServiceSpec{
// 			Type:  corev1.ServiceTypeClusterIP,
// 			Ports: servicePorts,
// 			Selector: map[string]string{
// 				"gitpod.io/instanceID":  instanceID,
// 				"gitpod.io/workspaceID": workspaceID,
// 				markerLabel:             "true",
// 			},
// 		},
// 	}, nil
// }

// func getPortsServiceName(servicePrefix string) string {
// 	return fmt.Sprintf("ws-%s-ports", strings.TrimSpace(strings.ToLower(servicePrefix)))
// }

func getServicePrefix(req *api.StartWorkspaceRequest) string {
	if req.ServicePrefix != "" {
		return req.ServicePrefix
	}

	return req.Id
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
