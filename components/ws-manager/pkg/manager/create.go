// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/imdario/mergo"
	volumesnapshotv1 "github.com/kubernetes-csi/external-snapshotter/client/v4/apis/volumesnapshot/v1"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/common-go/util"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
)

// Protobuf structures often require pointer to boolean values (as that's Go's best means of expression optionallity).
var (
	boolFalse = false
	boolTrue  = true
)

const (
	// maxSecretsLength is the maximum number of bytes a workspace secret may contain. This size is exhausted by
	// environment variables provided as part of the start workspace request.
	// The value of 768kb is a somewhat arbitrary choice, but steers way clear of the 1MiB Kubernetes imposes.
	maxSecretsLength = 768 * 1024 * 1024
)

// createWorkspacePod creates the actual workspace pod based on the definite workspace pod and appropriate
// templates. The result of this function is not expected to be modified prior to being passed to Kubernetes.
func (m *Manager) createWorkspacePod(startContext *startWorkspaceContext) (*corev1.Pod, error) {
	var templates config.WorkspacePodTemplateConfiguration
	if startContext.Class != nil {
		templates = startContext.Class.Templates
	}

	podTemplate, err := config.GetWorkspacePodTemplate(templates.DefaultPath)
	if err != nil {
		return nil, xerrors.Errorf("cannot read pod template - this is a configuration problem: %w", err)
	}
	var typeSpecificTpl *corev1.Pod
	switch startContext.Request.Type {
	case api.WorkspaceType_REGULAR:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(templates.RegularPath)
	case api.WorkspaceType_PREBUILD:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(templates.PrebuildPath)
	case api.WorkspaceType_IMAGEBUILD:
		typeSpecificTpl, err = config.GetWorkspacePodTemplate(templates.ImagebuildPath)
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

func podName(req *api.StartWorkspaceRequest) string {
	var prefix string
	switch req.Type {
	case api.WorkspaceType_PREBUILD:
		prefix = "prebuild"
	case api.WorkspaceType_IMAGEBUILD:
		prefix = "imagebuild"
	default:
		prefix = "ws"
	}
	return fmt.Sprintf("%s-%s", prefix, req.Id)
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

func (m *Manager) createPVCForWorkspacePod(startContext *startWorkspaceContext) (*corev1.PersistentVolumeClaim, error) {
	req := startContext.Request
	var prefix string
	switch req.Type {
	case api.WorkspaceType_PREBUILD:
		prefix = "prebuild"
	case api.WorkspaceType_IMAGEBUILD:
		prefix = "imagebuild"
	default:
		prefix = "ws"
	}

	PVCConfig := m.Config.WorkspaceClasses[config.DefaultWorkspaceClass].PVC
	if startContext.Class != nil {
		PVCConfig = startContext.Class.PVC
	}

	PVC := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-%s", prefix, req.Id),
			Namespace: m.Config.Namespace,
			Labels:    startContext.Labels,
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceName(corev1.ResourceStorage): PVCConfig.Size,
				},
			},
		},
	}
	if PVCConfig.StorageClass != "" {
		// Specify the storageClassName when the storage class is non-empty.
		// This way, the Kubernetes uses the default StorageClass within the cluster.
		// Otherwise, the Kubernetes would try to request the PVC with no class.
		PVC.Spec.StorageClassName = &PVCConfig.StorageClass
	}

	if startContext.VolumeSnapshot != nil && startContext.VolumeSnapshot.VolumeSnapshotName != "" {
		snapshotApiGroup := volumesnapshotv1.GroupName
		PVC.Spec.DataSource = &corev1.TypedLocalObjectReference{
			APIGroup: &snapshotApiGroup,
			Kind:     "VolumeSnapshot",
			Name:     startContext.VolumeSnapshot.VolumeSnapshotName,
		}
	}

	return PVC, nil
}

// createDefiniteWorkspacePod creates a workspace pod without regard for any template.
// The result of this function can be deployed and it would work.
func (m *Manager) createDefiniteWorkspacePod(startContext *startWorkspaceContext) (*corev1.Pod, error) {
	req := startContext.Request
	workspaceContainer, err := m.createWorkspaceContainer(startContext)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace container: %w", err)
	}

	// Beware: this allows setuid binaries in the workspace - supervisor needs to set no_new_privs now.
	// However: the whole user workload now runs in a user namespace, which makes this acceptable.
	workspaceContainer.SecurityContext.AllowPrivilegeEscalation = &boolTrue

	workspaceVolume, err := m.createWorkspaceVolumes(startContext)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace volumes: %w", err)
	}

	labels := make(map[string]string)
	labels["gitpod.io/networkpolicy"] = "default"
	for k, v := range startContext.Labels {
		labels[k] = v
	}

	ideRef := startContext.Request.Spec.DeprecatedIdeImage
	if startContext.Request.Spec.IdeImage != nil && len(startContext.Request.Spec.IdeImage.WebRef) > 0 {
		ideRef = startContext.Request.Spec.IdeImage.WebRef
	}
	var supervisorRef string
	if startContext.Request.Spec.IdeImage != nil && len(startContext.Request.Spec.IdeImage.SupervisorRef) > 0 {
		supervisorRef = startContext.Request.Spec.IdeImage.SupervisorRef
	}
	spec := regapi.ImageSpec{
		BaseRef:       startContext.Request.Spec.WorkspaceImage,
		IdeRef:        ideRef,
		SupervisorRef: supervisorRef,
	}

	if len(startContext.Request.Spec.IdeImageLayers) == 0 {
		var desktopIdeRef string
		var desktopIdePluginRef string
		if startContext.Request.Spec.IdeImage != nil {
			desktopIdeRef = startContext.Request.Spec.IdeImage.DesktopRef
			desktopIdePluginRef = startContext.Request.Spec.IdeImage.DesktopPluginRef
		}
		spec.IdeLayerRef = []string{desktopIdeRef, desktopIdePluginRef}
	} else {
		spec.IdeLayerRef = startContext.Request.Spec.IdeImageLayers
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

	annotations := map[string]string{
		workspaceIDAnnotation:                   req.Id,
		servicePrefixAnnotation:                 getServicePrefix(req),
		kubernetes.WorkspaceURLAnnotation:       startContext.WorkspaceURL,
		workspaceInitializerAnnotation:          initializerConfig,
		workspaceNeverReadyAnnotation:           "true",
		kubernetes.WorkspaceAdmissionAnnotation: admissionLevel,
		kubernetes.WorkspaceImageSpecAnnotation: imageSpec,
		kubernetes.OwnerTokenAnnotation:         startContext.OwnerToken,
		attemptingToCreatePodAnnotation:         "true",
		// TODO(cw): post Kubernetes 1.19 use GA form for settings those profiles
		"container.apparmor.security.beta.kubernetes.io/workspace": "unconfined",
		// prevent cluster-autoscaler from removing a node
		// https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node
		"cluster-autoscaler.kubernetes.io/safe-to-evict": "false",
	}
	if req.Spec.Timeout != "" {
		_, err := time.ParseDuration(req.Spec.Timeout)
		if err != nil {
			return nil, xerrors.Errorf("invalid workspace timeout \"%s\": %w", req.Spec.Timeout, err)
		}
		annotations[customTimeoutAnnotation] = req.Spec.Timeout
	}

	for k, v := range req.Metadata.Annotations {
		annotations[workspaceAnnotationPrefix+k] = v
	}
	if len(startContext.Request.Spec.SshPublicKeys) != 0 {
		spec := &api.SSHPublicKeys{
			Keys: startContext.Request.Spec.SshPublicKeys,
		}
		sshSpec, err := proto.Marshal(spec)
		if err != nil {
			return nil, xerrors.Errorf("cannot create remarshal of ssh key spec: %w", err)
		}
		sshSpecString := base64.StdEncoding.EncodeToString(sshSpec)
		annotations[kubernetes.WorkspaceSSHPublicKeys] = sshSpecString
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
					Path: filepath.Join(m.Config.WorkspaceHostPath, startContext.Request.Id+"-daemon"),
					Type: &hostPathOrCreate,
				},
			},
		},
	}

	// This is how we support custom CA certs in Gitpod workspaces.
	// Keep workspace templates clean.
	if m.Config.WorkspaceCACertSecret != "" {
		const volumeName = "custom-ca-certs"
		volumes = append(volumes, corev1.Volume{
			Name: volumeName,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: m.Config.WorkspaceCACertSecret,
					Items: []corev1.KeyToPath{
						{
							Key:  "ca.crt",
							Path: "ca.crt",
						},
					},
				},
			},
		})

		const mountPath = "/etc/ssl/certs/gitpod-ca.crt"
		workspaceContainer.VolumeMounts = append(workspaceContainer.VolumeMounts, corev1.VolumeMount{
			Name:      volumeName,
			ReadOnly:  true,
			MountPath: mountPath,
			SubPath:   "ca.crt",
		})
		workspaceContainer.Env = append(workspaceContainer.Env, corev1.EnvVar{
			Name:  "NODE_EXTRA_CA_CERTS",
			Value: mountPath,
		})
	}

	if req.Type == api.WorkspaceType_IMAGEBUILD {
		// mount self-signed gitpod CA certificate to ensure
		// we can push images to the in-cluster registry
		workspaceContainer.VolumeMounts = append(workspaceContainer.VolumeMounts,
			corev1.VolumeMount{
				Name:      "gitpod-ca-certificate",
				MountPath: "/usr/local/share/ca-certificates/gitpod-ca.crt",
				SubPath:   "ca.crt",
				ReadOnly:  true,
			},
		)
	}

	workloadType := "regular"
	if startContext.Headless {
		workloadType = "headless"
	}

	affinity := &corev1.Affinity{
		NodeAffinity: &corev1.NodeAffinity{
			RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
				NodeSelectorTerms: []corev1.NodeSelectorTerm{
					{
						MatchExpressions: []corev1.NodeSelectorRequirement{
							{
								Key:      "gitpod.io/workload_workspace_" + workloadType,
								Operator: corev1.NodeSelectorOpExists,
							},
							{
								Key:      "gitpod.io/ws-daemon_ready_ns_" + m.Config.Namespace,
								Operator: corev1.NodeSelectorOpExists,
							},
							{
								Key:      "gitpod.io/registry-facade_ready_ns_" + m.Config.Namespace,
								Operator: corev1.NodeSelectorOpExists,
							},
						},
					},
				},
			},
		},
	}

	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        podName(req),
			Namespace:   m.Config.Namespace,
			Labels:      labels,
			Annotations: annotations,
			Finalizers:  []string{gitpodFinalizerName},
		},
		Spec: corev1.PodSpec{
			Hostname:                     req.Metadata.MetaId,
			AutomountServiceAccountToken: &boolFalse,
			ServiceAccountName:           "workspace",
			SchedulerName:                m.Config.SchedulerName,
			EnableServiceLinks:           &boolFalse,
			Affinity:                     affinity,
			SecurityContext: &corev1.PodSecurityContext{
				// We're using a custom seccomp profile for user namespaces to allow clone, mount and chroot.
				// Those syscalls don't make much sense in a non-userns setting, where we default to runtime/default using the PodSecurityPolicy.
				SeccompProfile: &corev1.SeccompProfile{
					Type:             corev1.SeccompProfileTypeLocalhost,
					LocalhostProfile: pointer.String(m.Config.SeccompProfile),
				},
			},
			Containers: []corev1.Container{
				*workspaceContainer,
			},
			RestartPolicy: corev1.RestartPolicyNever,
			Volumes:       volumes,
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

	if m.Config.DebugWorkspacePod {
		pod.Finalizers = append(pod.Finalizers, "gitpod.io/debugfinalizer")
	}

	setProtectedSecrets(&pod, req)

	ffidx := make(map[api.WorkspaceFeatureFlag]struct{})
	for _, feature := range startContext.Request.Spec.FeatureFlags {
		if _, seen := ffidx[feature]; seen {
			continue
		}
		ffidx[feature] = struct{}{}

		switch feature {
		case api.WorkspaceFeatureFlag_FULL_WORKSPACE_BACKUP:
			removeVolume(&pod, workspaceVolumeName)
			pod.Labels[fullWorkspaceBackupLabel] = util.BooleanTrueString

		case api.WorkspaceFeatureFlag_NOOP:

		case api.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM:
			pod.Labels[pvcWorkspaceFeatureLabel] = util.BooleanTrueString

			// update volume to use persistent volume claim, and name of it is the same as pod's name
			pvcName := pod.ObjectMeta.Name
			pod.Spec.Volumes[0].VolumeSource = corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: pvcName,
				},
			}

			// SubPath so that lost+found is not visible
			pod.Spec.Containers[0].VolumeMounts[0].SubPath = "workspace"
			// not needed, since it is using dedicated disk
			pod.Spec.Containers[0].VolumeMounts[0].MountPropagation = nil

			// pavel: 133332 is the Gitpod UID (33333) shifted by 99999. The shift happens inside the workspace container due to the user namespace use.
			// We set this magical ID to make sure that gitpod user inside the workspace can write into /workspace folder mounted by PVC
			gitpodGUID := int64(133332)
			pod.Spec.SecurityContext.FSGroup = &gitpodGUID

			// add init container to chown workspace subpath, so that it is owned by gitpod user (there is no k8s native way of doing this as of right now)
			pod.Spec.InitContainers = append(pod.Spec.InitContainers, corev1.Container{
				Name:            "chown-workspace",
				Image:           "busybox",
				ImagePullPolicy: corev1.PullIfNotPresent,
				Command:         []string{"chown", "133332:133332", "/workspace"},
				VolumeMounts: []corev1.VolumeMount{
					{
						Name:      workspaceVolumeName,
						SubPath:   "workspace",
						MountPath: "/workspace",
					},
				},
			})

		case api.WorkspaceFeatureFlag_WORKSPACE_CLASS_LIMITING:
			limits := startContext.Class.Container.Limits
			if limits != nil && limits.CPU != nil {
				if limits.CPU.MinLimit != "" {
					annotations[kubernetes.WorkspaceCpuMinLimitAnnotation] = limits.CPU.MinLimit
				}

				if limits.CPU.BurstLimit != "" {
					annotations[kubernetes.WorkspaceCpuBurstLimitAnnotation] = limits.CPU.BurstLimit
				}
			}

		case api.WorkspaceFeatureFlag_WORKSPACE_CONNECTION_LIMITING:
			annotations[kubernetes.WorkspaceNetConnLimitAnnotation] = util.BooleanTrueString

		case api.WorkspaceFeatureFlag_WORKSPACE_PSI:
			annotations[kubernetes.WorkspacePressureStallInfoAnnotation] = util.BooleanTrueString

		default:
			log.Warnf("Unknown feature flag %v", feature)
		}
	}

	if req.Type == api.WorkspaceType_IMAGEBUILD {
		pod.Spec.Volumes = append(pod.Spec.Volumes, corev1.Volume{
			Name: "gitpod-ca-certificate",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: "builtin-registry-facade-cert",
					Items: []corev1.KeyToPath{
						{Key: "ca.crt", Path: "ca.crt"},
					},
				},
			},
		})
	}

	return &pod, nil
}

func setProtectedSecrets(pod *corev1.Pod, req *api.StartWorkspaceRequest) {
	for _, c := range pod.Spec.Containers {
		if c.Name != "workspace" {
			continue
		}

		for i, env := range c.Env {
			if !isProtectedEnvVar(env.Name, req.Spec.SysEnvvars) {
				continue
			}

			// already sourced from somewhere else
			if env.ValueFrom != nil {
				continue
			}

			env.Value = ""
			env.ValueFrom = &corev1.EnvVarSource{
				SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: corev1.LocalObjectReference{Name: pod.Name},
					Key:                  fmt.Sprintf("%x", sha256.Sum256([]byte(env.Name))),
				},
			}
			c.Env[i] = env
		}
	}
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
	var containerConfig config.ContainerConfiguration
	if startContext.Class != nil {
		containerConfig = startContext.Class.Container
	}

	limits, err := containerConfig.Limits.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspace container limits: %w", err)
	}
	requests, err := containerConfig.Requests.ResourceList()
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
		command        = []string{"/.supervisor/workspacekit", "ring0"}
		readinessProbe = &corev1.Probe{
			ProbeHandler: corev1.ProbeHandler{
				HTTPGet: &corev1.HTTPGetAction{
					Path:   "/_supervisor/v1/status/content/wait/true",
					Port:   intstr.FromInt((int)(startContext.SupervisorPort)),
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
			InitialDelaySeconds: 2,
		}
	)

	image := fmt.Sprintf("%s/%s/%s", m.Config.RegistryFacadeHost, regapi.ProviderPrefixRemote, startContext.Request.Id)

	return &corev1.Container{
		Name:            "workspace",
		Image:           image,
		SecurityContext: sec,
		ImagePullPolicy: corev1.PullIfNotPresent,
		Ports: []corev1.ContainerPort{
			{ContainerPort: startContext.IDEPort},
			{ContainerPort: startContext.SupervisorPort, Name: "supervisor"},
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

func (m *Manager) createWorkspaceEnvironment(startContext *startWorkspaceContext) ([]corev1.EnvVar, error) {
	spec := startContext.Request.Spec

	getWorkspaceRelativePath := func(segment string) string {
		// ensure we do not produce nested paths for the default workspace location
		return filepath.Join("/workspace", strings.TrimPrefix(segment, "/workspace"))
	}

	allRepoRoots := csapi.GetCheckoutLocationsFromInitializer(spec.Initializer)
	if len(allRepoRoots) == 0 {
		allRepoRoots = []string{""} // for backward compatibility, we are adding a single empty location (translates to /workspace/)
	}
	for i, root := range allRepoRoots {
		allRepoRoots[i] = getWorkspaceRelativePath(root)
	}

	// Envs that start with GITPOD_ are appended to the Terminal environments
	result := []corev1.EnvVar{}
	result = append(result, corev1.EnvVar{Name: "GITPOD_REPO_ROOT", Value: allRepoRoots[0]})
	result = append(result, corev1.EnvVar{Name: "GITPOD_REPO_ROOTS", Value: strings.Join(allRepoRoots, ",")})
	result = append(result, corev1.EnvVar{Name: "GITPOD_CLI_APITOKEN", Value: startContext.CLIAPIKey})
	result = append(result, corev1.EnvVar{Name: "GITPOD_OWNER_ID", Value: startContext.Request.Metadata.Owner})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_ID", Value: startContext.Request.Metadata.MetaId})
	result = append(result, corev1.EnvVar{Name: "GITPOD_INSTANCE_ID", Value: startContext.Request.Id})
	result = append(result, corev1.EnvVar{Name: "GITPOD_THEIA_PORT", Value: strconv.Itoa(int(startContext.IDEPort))})
	result = append(result, corev1.EnvVar{Name: "THEIA_WORKSPACE_ROOT", Value: getWorkspaceRelativePath(spec.WorkspaceLocation)})
	result = append(result, corev1.EnvVar{Name: "GITPOD_HOST", Value: m.Config.GitpodHostURL})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_URL", Value: startContext.WorkspaceURL})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_CLUSTER_HOST", Value: m.Config.WorkspaceClusterHost})
	result = append(result, corev1.EnvVar{Name: "GITPOD_WORKSPACE_CLASS", Value: startContext.Request.Spec.Class})
	result = append(result, corev1.EnvVar{Name: "THEIA_SUPERVISOR_ENDPOINT", Value: fmt.Sprintf(":%d", startContext.SupervisorPort)})
	// TODO(ak) remove THEIA_WEBVIEW_EXTERNAL_ENDPOINT and THEIA_MINI_BROWSER_HOST_PATTERN when Theia is removed
	result = append(result, corev1.EnvVar{Name: "THEIA_WEBVIEW_EXTERNAL_ENDPOINT", Value: "webview-{{hostname}}"})
	result = append(result, corev1.EnvVar{Name: "THEIA_MINI_BROWSER_HOST_PATTERN", Value: "browser-{{hostname}}"})

	// We don't require that Git be configured for workspaces
	if spec.Git != nil {
		result = append(result, corev1.EnvVar{Name: "GITPOD_GIT_USER_NAME", Value: spec.Git.Username})
		result = append(result, corev1.EnvVar{Name: "GITPOD_GIT_USER_EMAIL", Value: spec.Git.Email})
	}

	// System level env vars
	if spec.SysEnvvars != nil {
		for _, e := range spec.SysEnvvars {
			env := corev1.EnvVar{
				Name:  e.Name,
				Value: e.Value,
			}
			result = append(result, env)
		}
	}

	// User-defined env vars (i.e. those coming from the request)
	if spec.Envvars != nil {
		for _, e := range spec.Envvars {
			switch e.Name {
			case "GITPOD_WORKSPACE_CONTEXT",
				"GITPOD_WORKSPACE_CONTEXT_URL",
				"GITPOD_TASKS",
				"GITPOD_RESOLVED_EXTENSIONS",
				"GITPOD_EXTERNAL_EXTENSIONS",
				"GITPOD_WORKSPACE_CLASS_INFO",
				"GITPOD_IDE_ALIAS",
				"GITPOD_RLIMIT_CORE":
				// these variables are allowed - don't skip them
			default:
				if strings.HasPrefix(e.Name, "GITPOD_") {
					// we don't allow env vars starting with GITPOD_ and those that we do allow we've listed above
					continue
				}
			}

			env := corev1.EnvVar{
				Name:  e.Name,
				Value: e.Value,
			}
			if e.Value == "" && e.Secret != nil {
				env.ValueFrom = &corev1.EnvVarSource{
					SecretKeyRef: &corev1.SecretKeySelector{
						LocalObjectReference: corev1.LocalObjectReference{Name: e.Secret.SecretName},
						Key:                  e.Secret.Key,
					},
				}
			}
			result = append(result, env)
		}
	}

	heartbeatInterval := time.Duration(m.Config.HeartbeatInterval)
	result = append(result, corev1.EnvVar{Name: "GITPOD_INTERVAL", Value: fmt.Sprintf("%d", int64(heartbeatInterval/time.Millisecond))})

	res, err := startContext.ContainerConfiguration().Requests.ResourceList()
	if err != nil {
		return nil, xerrors.Errorf("cannot create environment: %w", err)
	}
	memoryInMegabyte := res.Memory().Value() / (1000 * 1000)
	result = append(result, corev1.EnvVar{Name: "GITPOD_MEMORY", Value: strconv.FormatInt(memoryInMegabyte, 10)})

	if startContext.Headless {
		result = append(result, corev1.EnvVar{Name: "GITPOD_HEADLESS", Value: "true"})
	}

	// remove empty or dup env vars
	cleanResult := make([]corev1.EnvVar, 0)
	envMap := make(map[string]struct{})
	for _, v := range result {
		if v.Name == "" || (v.Value == "" && v.ValueFrom == nil) {
			continue
		}
		if _, exist := envMap[v.Name]; exist {
			continue
		}
		envMap[v.Name] = struct{}{}
		cleanResult = append(cleanResult, v)
	}

	return cleanResult, nil
}

func isGitpodInternalEnvVar(name string) bool {
	return strings.HasPrefix(name, "GITPOD_") ||
		strings.HasPrefix(name, "SUPERVISOR_") ||
		strings.HasPrefix(name, "BOB_") ||
		strings.HasPrefix(name, "THEIA_") ||
		name == "NODE_EXTRA_CA_CERTS"
}

func isProtectedEnvVar(name string, sysEnvvars []*api.EnvironmentVariable) bool {
	switch name {
	case "THEIA_SUPERVISOR_TOKENS":
		return true
	default:
		if isGitpodInternalEnvVar(name) {
			return false
		}
		for _, env := range sysEnvvars {
			if env.Name == name {
				return false
			}
		}
		return true
	}
}

func (m *Manager) createWorkspaceVolumes(startContext *startWorkspaceContext) (workspace corev1.Volume, err error) {
	// silly protobuf structure design - this needs to be a reference to a string,
	// so we have to assign it to a variable first to take the address
	hostPathOrCreate := corev1.HostPathDirectoryOrCreate

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

func (m *Manager) newStartWorkspaceContext(ctx context.Context, req *api.StartWorkspaceRequest) (res *startWorkspaceContext, err error) {
	span, _ := tracing.FromContext(ctx, "newStartWorkspaceContext")
	defer tracing.FinishSpan(span, &err)

	workspaceType := strings.ToLower(api.WorkspaceType_name[int32(req.Type)])
	headless := false
	if req.Type != api.WorkspaceType_REGULAR {
		headless = true
	}

	workspaceURL, err := config.RenderWorkspaceURL(m.Config.WorkspaceURLTemplate, req.Id, req.ServicePrefix, m.Config.GitpodHostURL)
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

	clsName := req.Spec.Class
	if _, ok := m.Config.WorkspaceClasses[req.Spec.Class]; clsName == "" || !ok {
		// For the time being, if the requested workspace class is unknown, or if
		// no class is specified, we'll fall back to the default class.
		clsName = config.DefaultWorkspaceClass
	}

	var class *config.WorkspaceClass
	if cls, ok := m.Config.WorkspaceClasses[clsName]; ok {
		class = cls
	} else {
		return nil, status.Errorf(codes.InvalidArgument, "workspace class \"%s\" is unknown", clsName)
	}

	labels := map[string]string{
		"app":                  "gitpod",
		"component":            "workspace",
		wsk8s.WorkspaceIDLabel: req.Id,
		wsk8s.OwnerLabel:       req.Metadata.Owner,
		wsk8s.MetaIDLabel:      req.Metadata.MetaId,
		wsk8s.ProjectLabel:     req.Metadata.GetProject(),
		wsk8s.TeamLabel:        req.Metadata.GetTeam(),
		wsk8s.TypeLabel:        workspaceType,
		headlessLabel:          fmt.Sprintf("%v", headless),
		markerLabel:            "true",
		workspaceClassLabel:    clsName,
	}

	var volumeSnapshot *workspaceVolumeSnapshotStatus
	if req.Spec.VolumeSnapshot != nil {
		volumeSnapshot = &workspaceVolumeSnapshotStatus{
			VolumeSnapshotName:   req.Spec.VolumeSnapshot.VolumeSnapshotName,
			VolumeSnapshotHandle: req.Spec.VolumeSnapshot.VolumeSnapshotHandle,
		}
	}

	return &startWorkspaceContext{
		Labels:         labels,
		CLIAPIKey:      cliAPIKey,
		OwnerToken:     ownerToken,
		Request:        req,
		IDEPort:        23000,
		SupervisorPort: util.SupervisorPort,
		WorkspaceURL:   workspaceURL,
		Headless:       headless,
		Class:          class,
		VolumeSnapshot: volumeSnapshot,
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
