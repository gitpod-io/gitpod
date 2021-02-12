// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"

	"github.com/golang/protobuf/proto"
	"github.com/imdario/mergo"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// Protobuf structures often require pointer to boolean values (as that's Go's best means of expression optionallity).
var (
	boolFalse = false
	boolTrue  = true
)

// createWorkspacePod creates the actual workspace pod based on the definite workspace pod and appropriate
// templates. The result of this function is not expected to be modified prior to being passed to Kubernetes.
func (m *Manager) createWorkspacePod(startContext *startWorkspaceContext) (*corev1.Pod, error) {
	podTemplate, err := getWorkspacePodTemplate(m.Config.WorkspacePodTemplate.DefaultPath)
	if err != nil {
		return nil, xerrors.Errorf("cannot read pod template - this is a configuration problem: %w", err)
	}
	var typeSpecificTpl *corev1.Pod
	switch startContext.Request.Type {
	case api.WorkspaceType_REGULAR:
		typeSpecificTpl, err = getWorkspacePodTemplate(m.Config.WorkspacePodTemplate.RegularPath)
	case api.WorkspaceType_PREBUILD:
		typeSpecificTpl, err = getWorkspacePodTemplate(m.Config.WorkspacePodTemplate.PrebuildPath)
	case api.WorkspaceType_PROBE:
		typeSpecificTpl, err = getWorkspacePodTemplate(m.Config.WorkspacePodTemplate.ProbePath)
	case api.WorkspaceType_GHOST:
		typeSpecificTpl, err = getWorkspacePodTemplate(m.Config.WorkspacePodTemplate.GhostPath)
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

	pod, err := m.createDefiniteWorkspacePod(startContext)
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
func (m *Manager) createDefiniteWorkspacePod(startContext *startWorkspaceContext) (*corev1.Pod, error) {
	req := startContext.Request
	workspaceContainer, err := m.createWorkspaceContainer(startContext)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace container: %w", err)
	}
	theiaVolume, workspaceVolume, err := m.createWorkspaceVolumes(startContext)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace volumes: %w", err)
	}

	labels := make(map[string]string)
	labels["gitpod.io/networkpolicy"] = "default"
	for k, v := range startContext.Labels {
		labels[k] = v
	}

	// TODO(cw): once migrated to registry-facade, remove this bit
	// We're moving away from a fixed Theia image/version coupling and towards specifying a proper IDE image.
	// Once we're exclusively using registry-facade, we won't need this label anymore.
	var theiaVersion string
	if s := strings.Split(req.Spec.IdeImage, ":"); len(s) == 2 {
		theiaVersion = s[1]
	} else {
		return nil, xerrors.Errorf("IDE image ref does not have a label")
	}
	theiaVersionLabel := fmt.Sprintf(theiaVersionLabelFmt, theiaVersion)

	spec := regapi.ImageSpec{
		BaseRef: startContext.Request.Spec.WorkspaceImage,
		IdeRef:  startContext.Request.Spec.IdeImage,
	}
	imageSpec, err := spec.ToBase64()
	if err != nil {
		return nil, xerrors.Errorf("cannot create remarshal image spec: %w", err)
	}

	initCfg, err := proto.Marshal(startContext.Request.Spec.Initializer)
	if err != nil {
		return nil, xerrors.Errorf("cannot create remarshal initializer: %w", err)
	}
	initializerConfig := base64.StdEncoding.EncodeToString(initCfg)

	admissionLevel, ok := api.AdmissionLevel_name[int32(req.Spec.Admission)]
	if !ok {
		return nil, xerrors.Errorf("invalid admission level")
	}
	admissionLevel = strings.ToLower(admissionLevel)

	var prefix string
	switch req.Type {
	case api.WorkspaceType_PREBUILD:
		prefix = "prebuild"
	case api.WorkspaceType_PROBE:
		prefix = "probe"
	case api.WorkspaceType_GHOST:
		prefix = "ghost"
	default:
		prefix = "ws"
	}

	annotations := map[string]string{
		"prometheus.io/scrape":               "true",
		"prometheus.io/path":                 "/metrics",
		"prometheus.io/port":                 strconv.Itoa(int(startContext.IDEPort)),
		workspaceIDAnnotation:                req.Id,
		servicePrefixAnnotation:              getServicePrefix(req),
		workspaceURLAnnotation:               startContext.WorkspaceURL,
		workspaceInitializerAnnotation:       initializerConfig,
		workspaceNeverReadyAnnotation:        "true",
		workspaceAdmissionAnnotation:         admissionLevel,
		workspaceImageSpecAnnotation:         imageSpec,
		ownerTokenAnnotation:                 startContext.OwnerToken,
		wsk8s.TraceIDAnnotation:              startContext.TraceID,
		wsk8s.RequiredNodeServicesAnnotation: "ws-daemon",
		// TODO(cw): once userns workspaces become standard, set this to m.Config.SeccompProfile.
		//           Until then, the custom seccomp profile isn't suitable for workspaces.
		"seccomp.security.alpha.kubernetes.io/pod": "runtime/default",
	}
	if req.Spec.Timeout != "" {
		_, err := time.ParseDuration(req.Spec.Timeout)
		if err != nil {
			return nil, xerrors.Errorf("invalid workspace timeout \"%s\": %w", req.Spec.Timeout, err)
		}
		annotations[customTimeoutAnnotation] = req.Spec.Timeout
	}

	// By default we embue our workspace pods with some tolerance towards pressure taints,
	// see https://kubernetes.io/docs/concepts/configuration/taint-and-toleration/#taint-based-evictions
	// for more details. As hope/assume that the pressure might go away in this time.
	// Memory and Disk pressure are no reason to stop a workspace - instead of stopping a workspace
	// we'd rather wait things out or gracefully fail the workspace ourselves.
	var perssureToleranceSeconds int64 = 30

	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        fmt.Sprintf("%s-%s", prefix, req.Id),
			Labels:      labels,
			Annotations: annotations,
		},
		Spec: corev1.PodSpec{
			Affinity: &corev1.Affinity{
				NodeAffinity: &corev1.NodeAffinity{
					RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
						NodeSelectorTerms: []corev1.NodeSelectorTerm{
							{
								MatchExpressions: []corev1.NodeSelectorRequirement{
									{
										Key:      theiaVersionLabel,
										Operator: corev1.NodeSelectorOpExists,
									},
								},
							},
						},
					},
				},
			},
			AutomountServiceAccountToken: &boolFalse,
			ServiceAccountName:           "workspace",
			SchedulerName:                m.Config.SchedulerName,
			EnableServiceLinks:           &boolFalse,
			Containers: []corev1.Container{
				*workspaceContainer,
			},
			RestartPolicy: corev1.RestartPolicyNever,
			Volumes: []corev1.Volume{
				theiaVolume,
				workspaceVolume,
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

	ffidx := make(map[api.WorkspaceFeatureFlag]struct{})
	for _, feature := range startContext.Request.Spec.FeatureFlags {
		if _, seen := ffidx[feature]; seen {
			continue
		}
		ffidx[feature] = struct{}{}

		switch feature {
		case api.WorkspaceFeatureFlag_USER_NAMESPACE:
			// Beware: this allows setuid binaries in the workspace - supervisor needs to set no_new_privs now.
			// However: the whole user workload now runs in a user namespace, which makes this acceptable.
			workspaceContainer.SecurityContext.AllowPrivilegeEscalation = &boolTrue
			pod.Annotations[withUsernamespaceAnnotation] = "true"
			// TODO(cw): post Kubernetes 1.19 use GA form for settings those profiles
			pod.Annotations["container.apparmor.security.beta.kubernetes.io/workspace"] = "unconfined"
			// We're using a custom seccomp profile for user namespaces to allow clone, mount and chroot.
			// Those syscalls don't make much sense in a non-userns setting, where we default to runtime/default using the PodSecurityPolicy.
			pod.Annotations["seccomp.security.alpha.kubernetes.io/pod"] = m.Config.SeccompProfile
			// Mounting /dev/net/tun should be fine security-wise, because:
			//   - the TAP driver documentation says so (see https://www.kernel.org/doc/Documentation/networking/tuntap.txt)
			//   - systemd's nspawn does the same thing (if it's good enough for them, it's good enough for us)
			var (
				devType          = corev1.HostPathFile
				hostPathOrCreate = corev1.HostPathDirectoryOrCreate
				daemonVolumeName = "daemon-mount"
				mountPropagation = corev1.MountPropagationHostToContainer
			)
			pod.Spec.Volumes = append(pod.Spec.Volumes,
				corev1.Volume{
					Name: "dev-net-tun",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: "/dev/net/tun",
							Type: &devType,
						},
					},
				},
				corev1.Volume{
					Name: daemonVolumeName,
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: filepath.Join(m.Config.WorkspaceHostPath, startContext.Request.Id+"-daemon"),
							Type: &hostPathOrCreate,
						},
					},
				},
			)
			for i, c := range pod.Spec.Containers {
				if c.Name != "workspace" {
					continue
				}

				pod.Spec.Containers[i].VolumeMounts = append(c.VolumeMounts,
					corev1.VolumeMount{
						MountPath: "/dev/net/tun",
						Name:      "dev-net-tun",
					},
					corev1.VolumeMount{
						MountPath:        "/.workspace",
						Name:             daemonVolumeName,
						MountPropagation: &mountPropagation,
					},
				)
				pod.Spec.Containers[i].Command = []string{"/.supervisor/workspacekit", "ring0"}
				break
			}
		case api.WorkspaceFeatureFlag_FULL_WORKSPACE_BACKUP:
			removeVolume(&pod, workspaceVolumeName)
			pod.Labels[fullWorkspaceBackupAnnotation] = "true"
			pod.Annotations[fullWorkspaceBackupAnnotation] = "true"
			fallthrough
		case api.WorkspaceFeatureFlag_REGISTRY_FACADE:
			removeVolume(&pod, theiaVolumeName)

			image := fmt.Sprintf("%s/%s/%s", m.Config.RegistryFacadeHost, regapi.ProviderPrefixRemote, startContext.Request.Id)
			for i, c := range pod.Spec.Containers {
				if c.Name == "workspace" {
					pod.Spec.Containers[i].Image = image
					pod.Spec.Containers[i].Command = []string{"/.supervisor/supervisor", pod.Spec.Containers[i].Command[1]}
				}
			}

			onst := pod.Spec.Affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution.NodeSelectorTerms
			nst := make([]corev1.NodeSelectorTerm, 0, len(onst))
			for _, term := range onst {
				var notEmpty bool
				nt := term.MatchExpressions[:0]
				for _, expr := range term.MatchExpressions {
					if strings.HasPrefix(expr.Key, "gitpod.io/theia.") {
						continue
					}
					nt = append(nt, expr)
					notEmpty = true
				}
				if !notEmpty {
					continue
				}
				term.MatchExpressions = nt
				nst = append(nst, term)
			}

			if len(nst) == 0 {
				// if there wasn't a template that added additional terms here we'd be left with an empty term
				// which would prevent this pod from ever being scheduled.
				pod.Spec.Affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution = nil
			} else {
				pod.Spec.Affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution.NodeSelectorTerms = nst
			}
			if pod.Spec.Affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution == nil && len(pod.Spec.Affinity.NodeAffinity.PreferredDuringSchedulingIgnoredDuringExecution) == 0 {
				pod.Spec.Affinity.NodeAffinity = nil
			}
			if pod.Spec.Affinity.NodeAffinity == nil && pod.Spec.Affinity.PodAffinity == nil && pod.Spec.Affinity.PodAntiAffinity == nil {
				pod.Spec.Affinity = nil
			}

			pod.Annotations[wsk8s.RequiredNodeServicesAnnotation] += ",registry-facade"

		case api.WorkspaceFeatureFlag_FIXED_RESOURCES:
			var cpuLimit string
			for _, c := range pod.Spec.Containers {
				if c.Name != "workspace" {
					continue
				}
				cpuLimit = c.Resources.Limits.Cpu().String()
			}
			pod.Annotations[wsk8s.CPULimitAnnotation] = cpuLimit

		case api.WorkspaceFeatureFlag_NOOP:

		default:
			return nil, xerrors.Errorf("unknown feature flag: %v", feature)
		}
	}

	return &pod, nil
}

func removeVolume(pod *corev1.Pod, name string) {
	var vols []corev1.Volume
	for _, v := range pod.Spec.Volumes {
		if v.Name == name {
			continue
		}
		vols = append(vols, v)
	}
	pod.Spec.Volumes = vols

	for i, c := range pod.Spec.Containers {
		var mounts []corev1.VolumeMount
		for _, v := range c.VolumeMounts {
			if v.Name == name {
				continue
			}
			mounts = append(mounts, v)
		}
		pod.Spec.Containers[i].VolumeMounts = mounts
	}
}

func (m *Manager) createWorkspaceContainer(startContext *startWorkspaceContext) (*corev1.Container, error) {
	limits, err := m.Config.Container.Workspace.Limits.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspace container limits: %w", err)
	}
	requests, err := m.Config.Container.Workspace.Requests.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspace container requests: %w", err)
	}
	env, err := m.createWorkspaceEnvironment(startContext)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace env: %w", err)
	}
	sec, err := m.createDefaultSecurityContext()
	if err != nil {
		return nil, xerrors.Errorf("cannot create Theia env: %w", err)
	}
	mountPropagation := corev1.MountPropagationHostToContainer

	var (
		command        = []string{"/theia/supervisor", "run"}
		readinessProbe = &corev1.Probe{
			Handler: corev1.Handler{
				HTTPGet: &corev1.HTTPGetAction{
					Path:   "/_supervisor/v1/status/content/wait/true",
					Port:   intstr.FromInt((int)(startContext.SupervisorPort)),
					Scheme: corev1.URISchemeHTTP,
				},
			},
			// We make the readiness probe more difficult to fail than the liveness probe.
			// This way, if the workspace really has a problem it will be shut down by Kubernetes rather than end up in
			// some undefined state.
			FailureThreshold: 600,
			PeriodSeconds:    1,
			SuccessThreshold: 1,
			TimeoutSeconds:   1,
		}
	)

	if startContext.Request.Type == api.WorkspaceType_GHOST {
		command[1] = "ghost"
		readinessProbe = nil
	}

	return &corev1.Container{
		Name:            "workspace",
		Image:           startContext.Request.Spec.WorkspaceImage,
		SecurityContext: sec,
		ImagePullPolicy: corev1.PullAlways,
		Ports: []corev1.ContainerPort{
			{ContainerPort: startContext.IDEPort},
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
				Name:      theiaVolumeName,
				MountPath: theiaDir,
				ReadOnly:  true,
			},
		},
		ReadinessProbe:           readinessProbe,
		Env:                      env,
		Command:                  command,
		TerminationMessagePolicy: corev1.TerminationMessageFallbackToLogsOnError,
	}, nil
}

func (m *Manager) createWorkspaceEnvironment(startContext *startWorkspaceContext) ([]corev1.EnvVar, error) {
	spec := startContext.Request.Spec

	getWorkspaceRelativePath := func(segment string) string {
		return filepath.Join("/workspace", segment)
	}

	// Envs that start with GITPOD_ are appended to the Terminal environments
	result := []corev1.EnvVar{}
	result = append(result, corev1.EnvVar{Name: "GITPOD_REPO_ROOT", Value: getWorkspaceRelativePath(spec.CheckoutLocation)})
	result = append(result, corev1.EnvVar{Name: "GITPOD_CLI_APITOKEN", Value: startContext.CLIAPIKey})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_ID", Value: startContext.Request.Metadata.MetaId})
	result = append(result, corev1.EnvVar{Name: "GITPOD_INSTANCE_ID", Value: startContext.Request.Id})
	result = append(result, corev1.EnvVar{Name: "GITPOD_THEIA_PORT", Value: strconv.Itoa(int(startContext.IDEPort))})
	result = append(result, corev1.EnvVar{Name: "THEIA_WORKSPACE_ROOT", Value: getWorkspaceRelativePath(spec.WorkspaceLocation)})
	result = append(result, corev1.EnvVar{Name: "GITPOD_HOST", Value: m.Config.GitpodHostURL})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_URL", Value: startContext.WorkspaceURL})
	result = append(result, corev1.EnvVar{Name: "THEIA_SUPERVISOR_TOKEN", Value: m.Config.TheiaSupervisorToken})
	result = append(result, corev1.EnvVar{Name: "THEIA_SUPERVISOR_ENDPOINT", Value: fmt.Sprintf(":%d", startContext.SupervisorPort)})
	result = append(result, corev1.EnvVar{Name: "THEIA_WEBVIEW_EXTERNAL_ENDPOINT", Value: "webview-{{hostname}}"})
	result = append(result, corev1.EnvVar{Name: "THEIA_MINI_BROWSER_HOST_PATTERN", Value: "browser-{{hostname}}"})

	// We don't require that Git be configured for workspaces
	if spec.Git != nil {
		result = append(result, corev1.EnvVar{Name: "GITPOD_GIT_USER_NAME", Value: spec.Git.Username})
		result = append(result, corev1.EnvVar{Name: "GITPOD_GIT_USER_EMAIL", Value: spec.Git.Email})
	}

	// User-defined env vars (i.e. those coming from the request)
	if spec.Envvars != nil {
		for _, e := range spec.Envvars {
			if e.Name == "GITPOD_TASKS" || e.Name == "GITPOD_RESOLVED_EXTENSIONS" {
				result = append(result, corev1.EnvVar{Name: e.Name, Value: e.Value})
				continue
			} else if strings.HasPrefix(e.Name, "GITPOD_") {
				// we don't allow env vars starting with GITPOD_ and those that we do allow we've listed above
				continue
			}

			result = append(result, corev1.EnvVar{Name: e.Name, Value: e.Value})
		}
	}

	heartbeatInterval := time.Duration(m.Config.HeartbeatInterval)
	result = append(result, corev1.EnvVar{Name: "GITPOD_INTERVAL", Value: fmt.Sprintf("%d", int64(heartbeatInterval/time.Millisecond))})

	res, err := m.Config.Container.Workspace.Requests.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot create environment: %w", err)
	}
	memoryInMegabyte := res.Memory().Value() / (1000 * 1000)
	result = append(result, corev1.EnvVar{Name: "GITPOD_MEMORY", Value: strconv.FormatInt(memoryInMegabyte, 10)})

	if startContext.Headless {
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

func (m *Manager) createWorkspaceVolumes(startContext *startWorkspaceContext) (theia corev1.Volume, workspace corev1.Volume, err error) {
	// silly protobuf structure design - this needs to be a reference to a string,
	// so we have to assign it to a variable first to take the address
	hostPathOrCreate := corev1.HostPathDirectoryOrCreate
	hostPath := corev1.HostPathDirectory

	theia = corev1.Volume{
		Name: theiaVolumeName,
		VolumeSource: corev1.VolumeSource{
			HostPath: &corev1.HostPathVolumeSource{
				Path: m.Config.TheiaHostPath,
				Type: &hostPath,
			},
		},
	}
	workspace = corev1.Volume{
		Name: workspaceVolumeName,
		VolumeSource: corev1.VolumeSource{
			HostPath: &corev1.HostPathVolumeSource{
				Path: filepath.Join(m.Config.WorkspaceHostPath, startContext.Request.Id),
				Type: &hostPathOrCreate,
			},
		},
	}

	err = nil
	return
}

func (m *Manager) createDefaultSecurityContext() (*corev1.SecurityContext, error) {
	gitpodGUID := int64(33333)

	res := &corev1.SecurityContext{
		AllowPrivilegeEscalation: &boolFalse,
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
		Privileged:             &boolFalse,
		ReadOnlyRootFilesystem: &boolFalse,
		RunAsGroup:             &gitpodGUID,
		RunAsNonRoot:           &boolTrue,
		RunAsUser:              &gitpodGUID,
	}

	return res, nil
}

func (m *Manager) createPortsService(workspaceID string, metaID string, servicePrefix string, ports []*api.PortSpec) (*corev1.Service, error) {
	annotations := make(map[string]string)

	// allocate ports
	serviceName := getPortsServiceName(servicePrefix)
	var portsToAllocate []int
	for _, p := range ports {
		portsToAllocate = append(portsToAllocate, int(p.Port))
	}
	alloc, err := m.ingressPortAllocator.UpdateAllocatedPorts(metaID, serviceName, portsToAllocate)
	if err != nil {
		return nil, err
	}
	serializedPorts, err := alloc.Marshal()
	if err != nil {
		return nil, err
	}
	annotations[ingressPortsAnnotation] = string(serializedPorts)

	// create service ports
	servicePorts := make([]corev1.ServicePort, len(ports))
	for i, p := range ports {
		servicePorts[i] = corev1.ServicePort{
			Port:     int32(p.Port),
			Protocol: corev1.ProtocolTCP,
			Name:     portSpecToName(p),
		}
		if p.Target != 0 {
			servicePorts[i].TargetPort = intstr.FromInt(int(p.Target))
		}

		ingressPort, _ := alloc.AllocatedPort(int(p.Port))
		url, err := renderWorkspacePortURL(m.Config.WorkspacePortURLTemplate, portURLContext{
			Host:          m.Config.GitpodHostURL,
			ID:            metaID,
			IngressPort:   fmt.Sprint(ingressPort),
			Prefix:        servicePrefix,
			WorkspacePort: fmt.Sprint(p.Port),
		})
		if err != nil {
			return nil, xerrors.Errorf("cannot render public URL for %d: %w", p.Port, err)
		}
		annotations[fmt.Sprintf("gitpod/port-url-%d", p.Port)] = url
	}

	return &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: serviceName,
			Labels: map[string]string{
				"workspaceID":     workspaceID,
				wsk8s.MetaIDLabel: metaID,
				markerLabel:       "true",
			},
			Annotations: annotations,
		},
		Spec: corev1.ServiceSpec{
			Type:  corev1.ServiceTypeClusterIP,
			Ports: servicePorts,
			Selector: map[string]string{
				"workspaceID": workspaceID,
				markerLabel:   "true",
			},
		},
	}, nil
}

func (m *Manager) newStartWorkspaceContext(ctx context.Context, req *api.StartWorkspaceRequest) (res *startWorkspaceContext, err error) {
	// we deliberately do not shadow ctx here as we need the original context later to extract the TraceID
	span, ctx := tracing.FromContext(ctx, "newStartWorkspaceContext")
	defer tracing.FinishSpan(span, &err)

	workspaceType := strings.ToLower(api.WorkspaceType_name[int32(req.Type)])
	headless := false
	if req.Type != api.WorkspaceType_REGULAR {
		headless = true
	}

	workspaceURL, err := renderWorkspaceURL(m.Config.WorkspaceURLTemplate, req.Id, req.ServicePrefix, m.Config.GitpodHostURL)
	if err != nil {
		return nil, xerrors.Errorf("cannot get workspace URL: %w", err)
	}

	cliAPIKey, err := getRandomString(32)
	if err != nil {
		return nil, xerrors.Errorf("cannot create CLI API key: %w", err)
	}

	ownerToken, err := getRandomString(32)
	if err != nil {
		return nil, xerrors.Errorf("cannot create owner token: %w", err)
	}

	workspaceSpan := opentracing.StartSpan("workspace", opentracing.FollowsFrom(opentracing.SpanFromContext(ctx).Context()))
	traceID := tracing.GetTraceID(workspaceSpan)

	return &startWorkspaceContext{
		Labels: map[string]string{
			"app":                  "gitpod",
			"component":            "workspace",
			wsk8s.WorkspaceIDLabel: req.Id,
			wsk8s.OwnerLabel:       req.Metadata.Owner,
			wsk8s.MetaIDLabel:      req.Metadata.MetaId,
			wsk8s.TypeLabel:        workspaceType,
			headlessLabel:          fmt.Sprintf("%v", headless),
			markerLabel:            "true",
		},
		CLIAPIKey:      cliAPIKey,
		OwnerToken:     ownerToken,
		Request:        req,
		IDEPort:        23000,
		SupervisorPort: 22999,
		WorkspaceURL:   workspaceURL,
		TraceID:        traceID,
		Headless:       headless,
	}, nil
}

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
var validCookieChars = []byte("!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}")

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
