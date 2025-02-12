// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
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

	"github.com/imdario/mergo"
	"golang.org/x/xerrors"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/utils/pointer"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/constants"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

const (
	// workspaceVolume is the name of the workspace volume
	workspaceVolumeName = "vol-this-workspace"
	// workspaceDir is the path within all containers where workspaceVolume is mounted to
	workspaceDir = "/workspace"

	// headlessLabel marks a workspace as headless
	headlessLabel = "gitpod.io/headless"

	// instanceIDLabel is added for the container dispatch mechanism in ws-daemon to work
	// TODO(furisto): remove this label once we have moved ws-daemon to a controller setup
	instanceIDLabel = "gitpod.io/instanceID"

	// Grace time until the process in the workspace is properly completed
	// e.g. dockerd in the workspace may take some time to clean up the overlay directory.
	//
	// The high value here tries to avoid issues in nodes under load, we could face the deletion of the node, even if the pod is still in terminating state.
	// This could be related to creation of the backup or the upload to the object storage
	// https://github.com/kubernetes/autoscaler/blob/ee59c74cc0d61165c633d3e5b42caccc614be542/cluster-autoscaler/utils/drain/drain.go#L330
	// https://github.com/kubernetes/autoscaler/blob/ee59c74cc0d61165c633d3e5b42caccc614be542/cluster-autoscaler/utils/drain/drain.go#L107
	gracePeriod = 30 * time.Minute
)

type startWorkspaceContext struct {
	Config         *config.Configuration
	Workspace      *workspacev1.Workspace
	Labels         map[string]string `json:"labels"`
	IDEPort        int32             `json:"idePort"`
	SupervisorPort int32             `json:"supervisorPort"`
	Headless       bool              `json:"headless"`
	ServerVersion  *version.Info     `json:"serverVersion"`
}

// createWorkspacePod creates the actual workspace pod based on the definite workspace pod and appropriate
// templates. The result of this function is not expected to be modified prior to being passed to Kubernetes.
func (r *WorkspaceReconciler) createWorkspacePod(sctx *startWorkspaceContext) (*corev1.Pod, error) {
	class, ok := sctx.Config.WorkspaceClasses[sctx.Workspace.Spec.Class]
	if !ok {
		return nil, xerrors.Errorf("unknown workspace class: %s", sctx.Workspace.Spec.Class)
	}

	podTemplate, err := config.GetWorkspacePodTemplate(class.Templates.DefaultPath)
	if err != nil {
		return nil, xerrors.Errorf("cannot read pod template - this is a configuration problem: %w", err)
	}
	var typeSpecificTpl *corev1.Pod
	switch sctx.Workspace.Spec.Type {
	case workspacev1.WorkspaceTypeRegular:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(class.Templates.RegularPath)
	case workspacev1.WorkspaceTypePrebuild:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(class.Templates.PrebuildPath)
	case workspacev1.WorkspaceTypeImageBuild:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(class.Templates.ImagebuildPath)
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

	pod, err := createDefiniteWorkspacePod(sctx)
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
func createDefiniteWorkspacePod(sctx *startWorkspaceContext) (*corev1.Pod, error) {
	workspaceContainer, err := createWorkspaceContainer(sctx)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace container: %w", err)
	}

	// Beware: this allows setuid binaries in the workspace - supervisor needs to set no_new_privs now.
	// However: the whole user workload now runs in a user namespace, which makes this acceptable.
	workspaceContainer.SecurityContext.AllowPrivilegeEscalation = pointer.Bool(true)

	workspaceVolume, err := createWorkspaceVolumes(sctx)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace volumes: %w", err)
	}

	labels := make(map[string]string)
	labels["gitpod.io/networkpolicy"] = "default"
	for k, v := range sctx.Labels {
		labels[k] = v
	}

	var prefix string
	switch sctx.Workspace.Spec.Type {
	case workspacev1.WorkspaceTypePrebuild:
		prefix = "prebuild"
	case workspacev1.WorkspaceTypeImageBuild:
		prefix = "imagebuild"
	default:
		prefix = "ws"
	}

	annotations := map[string]string{
		"prometheus.io/scrape": "true",
		"prometheus.io/path":   "/metrics",
		"prometheus.io/port":   strconv.Itoa(int(sctx.IDEPort)),
		// prevent cluster-autoscaler from removing a node
		// https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node
		"cluster-autoscaler.kubernetes.io/safe-to-evict": "false",
	}

	configureAppamor(sctx, annotations, workspaceContainer)

	for k, v := range sctx.Workspace.Annotations {
		annotations[k] = v
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
	volumes := []corev1.Volume{
		workspaceVolume,
		{
			Name: daemonVolumeName,
			VolumeSource: corev1.VolumeSource{
				HostPath: &corev1.HostPathVolumeSource{
					Path: filepath.Join(sctx.Config.WorkspaceHostPath, sctx.Workspace.Name+"-daemon"),
					Type: &hostPathOrCreate,
				},
			},
		},
	}

	if sctx.Config.EnableCustomSSLCertificate {
		volumes = append(volumes, corev1.Volume{
			Name: "gitpod-ca-crt",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: "gitpod-customer-certificate-bundle"},
				},
			},
		})
	}

	workloadType := "regular"
	if sctx.Headless {
		workloadType = "headless"
	}

	matchExpressions := []corev1.NodeSelectorRequirement{
		{
			Key:      "gitpod.io/workload_workspace_" + workloadType,
			Operator: corev1.NodeSelectorOpExists,
		},
		{
			Key:      "gitpod.io/ws-daemon_ready_ns_" + sctx.Config.Namespace,
			Operator: corev1.NodeSelectorOpExists,
		},
		{
			Key:      "gitpod.io/registry-facade_ready_ns_" + sctx.Config.Namespace,
			Operator: corev1.NodeSelectorOpExists,
		},
	}

	affinity := &corev1.Affinity{
		NodeAffinity: &corev1.NodeAffinity{
			RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
				NodeSelectorTerms: []corev1.NodeSelectorTerm{
					{
						MatchExpressions: matchExpressions,
					},
				},
			},
		},
	}

	graceSec := int64(gracePeriod.Seconds())
	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        fmt.Sprintf("%s-%s", prefix, sctx.Workspace.Name),
			Namespace:   sctx.Config.Namespace,
			Labels:      labels,
			Annotations: annotations,
			Finalizers:  []string{workspacev1.GitpodFinalizerName},
		},
		Spec: corev1.PodSpec{
			Hostname:                     sctx.Workspace.Spec.Ownership.WorkspaceID,
			AutomountServiceAccountToken: pointer.Bool(false),
			ServiceAccountName:           "workspace",
			SchedulerName:                sctx.Config.SchedulerName,
			EnableServiceLinks:           pointer.Bool(false),
			Affinity:                     affinity,
			SecurityContext: &corev1.PodSecurityContext{
				// We're using a custom seccomp profile for user namespaces to allow clone, mount and chroot.
				SeccompProfile: &corev1.SeccompProfile{
					Type:             corev1.SeccompProfileTypeLocalhost,
					LocalhostProfile: pointer.String(sctx.Config.SeccompProfile),
				},
			},
			Containers: []corev1.Container{
				*workspaceContainer,
			},
			RestartPolicy:                 corev1.RestartPolicyNever,
			Volumes:                       volumes,
			TerminationGracePeriodSeconds: &graceSec,
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

	return &pod, nil
}

func createWorkspaceContainer(sctx *startWorkspaceContext) (*corev1.Container, error) {
	class, ok := sctx.Config.WorkspaceClasses[sctx.Workspace.Spec.Class]
	if !ok {
		return nil, xerrors.Errorf("unknown workspace class: %s", sctx.Workspace.Spec.Class)
	}

	limits, err := class.Container.Limits.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspace container limits: %w", err)
	}
	requests, err := class.Container.Requests.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspace container requests: %w", err)
	}
	env, err := createWorkspaceEnvironment(sctx)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace env: %w", err)
	}
	sec, err := createDefaultSecurityContext()
	if err != nil {
		return nil, xerrors.Errorf("cannot create Theia env: %w", err)
	}
	mountPropagation := corev1.MountPropagationHostToContainer

	var (
		command        = []string{"/.supervisor/workspacekit", "ring0"}
		readinessProbe = &corev1.Probe{
			ProbeHandler: corev1.ProbeHandler{
				HTTPGet: &corev1.HTTPGetAction{
					Path:   "/_supervisor/v1/status/ide/wait/true",
					Port:   intstr.FromInt((int)(sctx.SupervisorPort)),
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
			InitialDelaySeconds: 1,
		}
	)

	image := fmt.Sprintf("%s/%s/%s", sctx.Config.RegistryFacadeHost, regapi.ProviderPrefixRemote, sctx.Workspace.Name)

	volumeMounts := []corev1.VolumeMount{
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
	}

	if sctx.Config.EnableCustomSSLCertificate {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "gitpod-ca-crt",
			MountPath: "/etc/ssl/certs/gitpod-ca.crt",
			SubPath:   "ca-certificates.crt",
			ReadOnly:  true,
		})
	}

	return &corev1.Container{
		Name:            "workspace",
		Image:           image,
		SecurityContext: sec,
		ImagePullPolicy: corev1.PullIfNotPresent,
		Ports: []corev1.ContainerPort{
			{ContainerPort: sctx.IDEPort},
		},
		Resources: corev1.ResourceRequirements{
			Limits:   limits,
			Requests: requests,
		},
		VolumeMounts:             volumeMounts,
		ReadinessProbe:           readinessProbe,
		Env:                      env,
		Command:                  command,
		TerminationMessagePolicy: corev1.TerminationMessageReadFile,
	}, nil
}

func createWorkspaceEnvironment(sctx *startWorkspaceContext) ([]corev1.EnvVar, error) {
	class, ok := sctx.Config.WorkspaceClasses[sctx.Workspace.Spec.Class]
	if !ok {
		return nil, xerrors.Errorf("unknown workspace class: %s", sctx.Workspace.Spec.Class)
	}

	getWorkspaceRelativePath := func(segment string) string {
		// ensure we do not produce nested paths for the default workspace location
		return filepath.Join("/workspace", strings.TrimPrefix(segment, "/workspace"))
	}

	var init csapi.WorkspaceInitializer
	err := proto.Unmarshal(sctx.Workspace.Spec.Initializer, &init)
	if err != nil {
		err = fmt.Errorf("cannot unmarshal initializer config: %w", err)
		return nil, err
	}

	allRepoRoots := csapi.GetCheckoutLocationsFromInitializer(&init)
	if len(allRepoRoots) == 0 {
		allRepoRoots = []string{""} // for backward compatibility, we are adding a single empty location (translates to /workspace/)
	}
	for i, root := range allRepoRoots {
		allRepoRoots[i] = getWorkspaceRelativePath(root)
	}

	// Can't read the workspace URL from status yet, as the status likely hasn't
	// been set by the controller yet at this point. Therefore, manually construct
	// the URL to pass to the container env.
	wsUrl, err := config.RenderWorkspaceURL(sctx.Config.WorkspaceURLTemplate, sctx.Workspace.Name, sctx.Workspace.Spec.Ownership.WorkspaceID, sctx.Config.GitpodHostURL)
	if err != nil {
		return nil, fmt.Errorf("cannot render workspace URL: %w", err)
	}

	// Envs that start with GITPOD_ are appended to the Terminal environments
	result := []corev1.EnvVar{}
	result = append(result, corev1.EnvVar{Name: "GITPOD_REPO_ROOT", Value: allRepoRoots[0]})
	result = append(result, corev1.EnvVar{Name: "GITPOD_REPO_ROOTS", Value: strings.Join(allRepoRoots, ",")})
	result = append(result, corev1.EnvVar{Name: "GITPOD_OWNER_ID", Value: sctx.Workspace.Spec.Ownership.Owner})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_ID", Value: sctx.Workspace.Spec.Ownership.WorkspaceID})
	result = append(result, corev1.EnvVar{Name: "GITPOD_INSTANCE_ID", Value: sctx.Workspace.Name})
	result = append(result, corev1.EnvVar{Name: "GITPOD_THEIA_PORT", Value: strconv.Itoa(int(sctx.IDEPort))})
	result = append(result, corev1.EnvVar{Name: "THEIA_WORKSPACE_ROOT", Value: getWorkspaceRelativePath(sctx.Workspace.Spec.WorkspaceLocation)})
	result = append(result, corev1.EnvVar{Name: "GITPOD_HOST", Value: sctx.Config.GitpodHostURL})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_URL", Value: wsUrl})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_CLUSTER_HOST", Value: sctx.Config.WorkspaceClusterHost})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_CLASS", Value: sctx.Workspace.Spec.Class})
	result = append(result, corev1.EnvVar{Name: "THEIA_SUPERVISOR_ENDPOINT", Value: fmt.Sprintf(":%d", sctx.SupervisorPort)})
	// TODO(ak) remove THEIA_WEBVIEW_EXTERNAL_ENDPOINT and THEIA_MINI_BROWSER_HOST_PATTERN when Theia is removed
	result = append(result, corev1.EnvVar{Name: "THEIA_WEBVIEW_EXTERNAL_ENDPOINT", Value: "webview-{{hostname}}"})
	result = append(result, corev1.EnvVar{Name: "THEIA_MINI_BROWSER_HOST_PATTERN", Value: "browser-{{hostname}}"})

	result = append(result, corev1.EnvVar{Name: "GITPOD_SSH_CA_PUBLIC_KEY", Value: sctx.Workspace.Spec.SSHGatewayCAPublicKey})

	// We don't require that Git be configured for workspaces
	if sctx.Workspace.Spec.Git != nil {
		result = append(result, corev1.EnvVar{Name: "GITPOD_GIT_USER_NAME", Value: sctx.Workspace.Spec.Git.Username})
		result = append(result, corev1.EnvVar{Name: "GITPOD_GIT_USER_EMAIL", Value: sctx.Workspace.Spec.Git.Email})
	}

	if sctx.Config.EnableCustomSSLCertificate {
		const (
			customCAMountPath = "/etc/ssl/certs/gitpod-ca.crt"
			certsMountPath    = "/etc/ssl/certs/"
		)

		result = append(result, corev1.EnvVar{Name: "NODE_EXTRA_CA_CERTS", Value: customCAMountPath})
		result = append(result, corev1.EnvVar{Name: "GIT_SSL_CAPATH", Value: certsMountPath})
		result = append(result, corev1.EnvVar{Name: "GIT_SSL_CAINFO", Value: customCAMountPath})
	}

	// System level env vars
	for _, e := range sctx.Workspace.Spec.SysEnvVars {
		env := corev1.EnvVar{
			Name:  e.Name,
			Value: e.Value,
		}
		result = append(result, env)
	}

	// User-defined env vars (i.e. those coming from the request)
	for _, e := range sctx.Workspace.Spec.UserEnvVars {
		switch e.Name {
		case "GITPOD_WORKSPACE_CONTEXT",
			"GITPOD_WORKSPACE_CONTEXT_URL",
			"GITPOD_TASKS",
			"GITPOD_RESOLVED_EXTENSIONS",
			"GITPOD_EXTERNAL_EXTENSIONS",
			"GITPOD_WORKSPACE_CLASS_INFO",
			"GITPOD_IDE_ALIAS",
			"GITPOD_RLIMIT_CORE",
			"GITPOD_IMAGE_AUTH":
			// these variables are allowed - don't skip them
		default:
			if strings.HasPrefix(e.Name, "GITPOD_") {
				// we don't allow env vars starting with GITPOD_ and those that we do allow we've listed above
				continue
			}
		}

		result = append(result, e)
	}

	heartbeatInterval := time.Duration(sctx.Config.HeartbeatInterval)
	result = append(result, corev1.EnvVar{Name: "GITPOD_INTERVAL", Value: fmt.Sprintf("%d", int64(heartbeatInterval/time.Millisecond))})

	res, err := class.Container.Requests.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot create environment: %w", err)
	}
	memoryInMegabyte := res.Memory().Value() / (1024 * 1024)
	result = append(result, corev1.EnvVar{Name: "GITPOD_MEMORY", Value: strconv.FormatInt(memoryInMegabyte, 10)})

	cpuCount := res.Cpu().Value()
	result = append(result, corev1.EnvVar{Name: "GITPOD_CPU_COUNT", Value: strconv.FormatInt(int64(cpuCount), 10)})

	if sctx.Headless {
		result = append(result, corev1.EnvVar{Name: "GITPOD_HEADLESS", Value: "true"})
	}

	// remove empty env vars
	cleanResult := make([]corev1.EnvVar, 0)
	for _, v := range result {
		if v.Name == "" || (v.Value == "" && v.ValueFrom == nil) {
			continue
		}

		cleanResult = append(cleanResult, v)
	}

	return cleanResult, nil
}

func createWorkspaceVolumes(sctx *startWorkspaceContext) (workspace corev1.Volume, err error) {
	// silly protobuf structure design - this needs to be a reference to a string,
	// so we have to assign it to a variable first to take the address
	hostPathOrCreate := corev1.HostPathDirectoryOrCreate

	workspace = corev1.Volume{
		Name: workspaceVolumeName,
		VolumeSource: corev1.VolumeSource{
			HostPath: &corev1.HostPathVolumeSource{
				Path: filepath.Join(sctx.Config.WorkspaceHostPath, sctx.Workspace.Name),
				Type: &hostPathOrCreate,
			},
		},
	}

	err = nil
	return
}

func createDefaultSecurityContext() (*corev1.SecurityContext, error) {
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

func newStartWorkspaceContext(ctx context.Context, cfg *config.Configuration, ws *workspacev1.Workspace, serverVersion *version.Info) (res *startWorkspaceContext, err error) {
	// we deliberately do not shadow ctx here as we need the original context later to extract the TraceID
	span, _ := tracing.FromContext(ctx, "newStartWorkspaceContext")
	defer tracing.FinishSpan(span, &err)

	return &startWorkspaceContext{
		Labels: map[string]string{
			"app":                         "gitpod",
			"component":                   "workspace",
			wsk8s.MetaIDLabel:             ws.Spec.Ownership.WorkspaceID,
			wsk8s.WorkspaceIDLabel:        ws.Name,
			wsk8s.OwnerLabel:              ws.Spec.Ownership.Owner,
			wsk8s.TypeLabel:               strings.ToLower(string(ws.Spec.Type)),
			wsk8s.WorkspaceManagedByLabel: constants.ManagedBy,
			instanceIDLabel:               ws.Name,
			headlessLabel:                 strconv.FormatBool(ws.IsHeadless()),
		},
		Config:         cfg,
		Workspace:      ws,
		IDEPort:        23000,
		SupervisorPort: 22999,
		Headless:       ws.IsHeadless(),
		ServerVersion:  serverVersion,
	}, nil
}

func configureAppamor(sctx *startWorkspaceContext, annotations map[string]string, workspaceContainer *corev1.Container) {
	// pre K8s 1.30 we need to set the apparmor profile to unconfined as an annotation
	if sctx.ServerVersion.Major <= "1" && sctx.ServerVersion.Minor < "30" {
		annotations["container.apparmor.security.beta.kubernetes.io/workspace"] = "unconfined"
	} else {
		workspaceContainer.SecurityContext.AppArmorProfile = &corev1.AppArmorProfile{
			Type: corev1.AppArmorProfileTypeUnconfined,
		}
	}
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
