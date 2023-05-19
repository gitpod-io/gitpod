// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"encoding/base64"
	"net/url"
	"strings"
	"time"

	"golang.org/x/xerrors"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	wsapi "github.com/gitpod-io/gitpod/ws-manager/api"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

// WorkspaceCoords represents the coordinates of a workspace (port).
type WorkspaceCoords struct {
	// The workspace ID
	ID string
	// The workspace port
	Port string
	// Debug workspace
	Debug bool
}

// WorkspaceInfoProvider is an entity that is able to provide workspaces related information.
type WorkspaceInfoProvider interface {
	// WorkspaceInfo returns the workspace information of a workspace using it's workspace ID
	WorkspaceInfo(workspaceID string) *WorkspaceInfo
}

// WorkspaceInfo is all the infos ws-proxy needs to know about a workspace.
type WorkspaceInfo struct {
	WorkspaceID string
	InstanceID  string
	URL         string

	IDEImage        string
	SupervisorImage string

	// (parsed from URL)
	IDEPublicPort string

	IPAddress string

	Ports []*api.PortSpec

	Auth      *wsapi.WorkspaceAuthentication
	StartedAt time.Time

	OwnerUserId   string
	SSHPublicKeys []string
}

// RemoteWorkspaceInfoProvider provides (cached) infos about running workspaces that it queries from ws-manager.
type RemoteWorkspaceInfoProvider struct {
	client.Client
	Scheme *runtime.Scheme

	store cache.ThreadSafeStore
}

const (
	workspaceIndex = "workspaceIndex"
)

// NewRemoteWorkspaceInfoProvider creates a fresh WorkspaceInfoProvider.
func NewRemoteWorkspaceInfoProvider(client client.Client, scheme *runtime.Scheme) *RemoteWorkspaceInfoProvider {
	// create custom indexer for searches
	indexers := cache.Indexers{
		workspaceIndex: func(obj interface{}) ([]string, error) {
			if workspaceInfo, ok := obj.(*WorkspaceInfo); ok {
				return []string{workspaceInfo.WorkspaceID}, nil
			}

			return nil, xerrors.Errorf("object is not a WorkspaceInfo")
		},
	}

	return &RemoteWorkspaceInfoProvider{
		Client: client,
		Scheme: scheme,

		store: cache.NewThreadSafeStore(indexers, cache.Indices{}),
	}
}

func (r *RemoteWorkspaceInfoProvider) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var pod corev1.Pod
	err := r.Client.Get(context.Background(), req.NamespacedName, &pod)
	if errors.IsNotFound(err) {
		// pod is gone - that's ok
		r.store.Delete(req.Name)
		log.WithField("workspace", req.Name).Debug("removing workspace from store")

		return reconcile.Result{}, nil
	}

	// extract workspace details from pod and store
	workspaceInfo := mapPodToWorkspaceInfo(&pod)
	r.store.Update(req.Name, workspaceInfo)
	log.WithField("workspace", req.Name).WithField("details", workspaceInfo).Debug("adding/updating workspace details")

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *RemoteWorkspaceInfoProvider) SetupWithManager(mgr ctrl.Manager) error {
	podWorkspaceSelector, err := predicate.LabelSelectorPredicate(metav1.LabelSelector{
		MatchLabels: map[string]string{
			"app":       "gitpod",
			"component": "workspace",
			"gpwsman":   "true",
		},
	})
	if err != nil {
		return err
	}

	return ctrl.NewControllerManagedBy(mgr).
		Named("pod").
		WithEventFilter(predicate.ResourceVersionChangedPredicate{}).
		For(
			&corev1.Pod{},
			builder.WithPredicates(podWorkspaceSelector),
		).
		Complete(r)
}

func mapPodToWorkspaceInfo(pod *corev1.Pod) *WorkspaceInfo {
	ownerToken := pod.Annotations[kubernetes.OwnerTokenAnnotation]
	admission := wsapi.AdmissionLevel_ADMIT_OWNER_ONLY
	if av, ok := wsapi.AdmissionLevel_value[strings.ToUpper(pod.Annotations[kubernetes.WorkspaceAdmissionAnnotation])]; ok {
		admission = wsapi.AdmissionLevel(av)
	}

	imageSpec, _ := regapi.ImageSpecFromBase64(pod.Annotations[kubernetes.WorkspaceImageSpecAnnotation])

	workspaceURL := pod.Annotations[kubernetes.WorkspaceURLAnnotation]

	return &WorkspaceInfo{
		WorkspaceID:     pod.Labels[kubernetes.MetaIDLabel],
		InstanceID:      pod.Labels[kubernetes.WorkspaceIDLabel],
		URL:             workspaceURL,
		IDEImage:        imageSpec.IdeRef,
		IDEPublicPort:   getPortStr(workspaceURL),
		SupervisorImage: imageSpec.SupervisorRef,
		IPAddress:       pod.Status.PodIP,
		Ports:           extractExposedPorts(pod).Ports,
		Auth:            &wsapi.WorkspaceAuthentication{Admission: admission, OwnerToken: ownerToken},
		StartedAt:       pod.CreationTimestamp.Time,
		OwnerUserId:     pod.Labels[kubernetes.OwnerLabel],
		SSHPublicKeys:   extractUserSSHPublicKeys(pod),
	}
}

// WorkspaceInfo return the WorkspaceInfo available for the given workspaceID.
func (r *RemoteWorkspaceInfoProvider) WorkspaceInfo(workspaceID string) *WorkspaceInfo {
	workspaces, err := r.store.ByIndex(workspaceIndex, workspaceID)
	if err != nil {
		return nil
	}

	if len(workspaces) == 1 {
		return workspaces[0].(*WorkspaceInfo)
	}

	return nil
}

// getPortStr extracts the port part from a given URL string. Returns "" if parsing fails or port is not specified.
func getPortStr(urlStr string) string {
	portURL, err := url.Parse(urlStr)
	if err != nil {
		log.WithField("url", urlStr).WithError(err).Error("error parsing URL while getting URL port")
		return ""
	}
	if portURL.Port() == "" {
		switch scheme := portURL.Scheme; scheme {
		case "http":
			return "80"
		case "https":
			return "443"
		}
	}

	return portURL.Port()
}

type CRDWorkspaceInfoProvider struct {
	client.Client
	Scheme *runtime.Scheme

	store cache.ThreadSafeStore
}

// NewRemoteWorkspaceInfoProvider creates a fresh WorkspaceInfoProvider.
func NewCRDWorkspaceInfoProvider(client client.Client, scheme *runtime.Scheme) (*CRDWorkspaceInfoProvider, error) {
	// create custom indexer for searches
	indexers := cache.Indexers{
		workspaceIndex: func(obj interface{}) ([]string, error) {
			if workspaceInfo, ok := obj.(*WorkspaceInfo); ok {
				return []string{workspaceInfo.WorkspaceID}, nil
			}

			return nil, xerrors.Errorf("object is not a WorkspaceInfo")
		},
	}

	return &CRDWorkspaceInfoProvider{
		Client: client,
		Scheme: scheme,

		store: cache.NewThreadSafeStore(indexers, cache.Indices{}),
	}, nil
}

// WorkspaceInfo return the WorkspaceInfo available for the given workspaceID.
func (r *CRDWorkspaceInfoProvider) WorkspaceInfo(workspaceID string) *WorkspaceInfo {
	workspaces, err := r.store.ByIndex(workspaceIndex, workspaceID)
	if err != nil {
		return nil
	}

	if len(workspaces) == 1 {
		return workspaces[0].(*WorkspaceInfo)
	}

	return nil
}

func (r *CRDWorkspaceInfoProvider) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var ws workspacev1.Workspace
	err := r.Client.Get(context.Background(), req.NamespacedName, &ws)
	if errors.IsNotFound(err) {
		// workspace is gone - that's ok
		r.store.Delete(req.Name)
		log.WithField("workspacepod", req.Name).Debug("removing workspace from store")

		return reconcile.Result{}, nil
	}

	var podIP string
	if ws.Status.Runtime != nil {
		podIP = ws.Status.Runtime.PodIP
	}

	ports := make([]*wsapi.PortSpec, 0, len(ws.Spec.Ports))
	for _, p := range ws.Spec.Ports {
		v := wsapi.PortVisibility_PORT_VISIBILITY_PRIVATE
		protocol := wsapi.PortProtocol_PORT_PROTOCOL_HTTP
		if p.Visibility == workspacev1.AdmissionLevelEveryone {
			v = wsapi.PortVisibility_PORT_VISIBILITY_PUBLIC
		}
		if p.Protocol == workspacev1.PortProtocolHttps {
			protocol = wsapi.PortProtocol_PORT_PROTOCOL_HTTPS
		}
		ports = append(ports, &wsapi.PortSpec{
			Port:       p.Port,
			Visibility: v,
			Protocol:   protocol,
		})
	}

	admission := wsapi.AdmissionLevel_ADMIT_OWNER_ONLY
	if ws.Spec.Admission.Level == workspacev1.AdmissionLevelEveryone {
		admission = wsapi.AdmissionLevel_ADMIT_EVERYONE
	}
	wsinfo := &WorkspaceInfo{
		WorkspaceID:     ws.Spec.Ownership.WorkspaceID,
		InstanceID:      ws.Name,
		URL:             ws.Status.URL,
		IDEImage:        ws.Spec.Image.IDE.Web,
		SupervisorImage: ws.Spec.Image.IDE.Supervisor,
		IDEPublicPort:   getPortStr(ws.Status.URL),
		IPAddress:       podIP,
		Ports:           ports,
		Auth:            &wsapi.WorkspaceAuthentication{Admission: admission, OwnerToken: ws.Status.OwnerToken},
		StartedAt:       ws.CreationTimestamp.Time,
		SSHPublicKeys:   ws.Spec.SshPublicKeys,
	}

	r.store.Update(req.Name, wsinfo)
	log.WithField("workspace", req.Name).WithField("details", wsinfo).Debug("adding/updating workspace details")

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *CRDWorkspaceInfoProvider) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		Named("workspacecrd").
		WithEventFilter(predicate.ResourceVersionChangedPredicate{}).
		For(
			&workspacev1.Workspace{},
		).
		Complete(r)
}

// CompositeInfoProvider checks each of its info providers and returns the first info found.
type CompositeInfoProvider []WorkspaceInfoProvider

func (c CompositeInfoProvider) WorkspaceInfo(workspaceID string) *WorkspaceInfo {
	for _, ip := range c {
		res := ip.WorkspaceInfo(workspaceID)
		if res != nil {
			return res
		}
	}
	return nil
}

type fixedInfoProvider struct {
	Infos map[string]*WorkspaceInfo
}

// WorkspaceInfo returns the workspace information of a workspace using it's workspace ID.
func (fp *fixedInfoProvider) WorkspaceInfo(workspaceID string) *WorkspaceInfo {
	if fp.Infos == nil {
		return nil
	}
	return fp.Infos[workspaceID]
}

func extractExposedPorts(pod *corev1.Pod) *api.ExposedPorts {
	if data, ok := pod.Annotations[kubernetes.WorkspaceExposedPorts]; ok {
		ports, _ := api.ExposedPortsFromBase64(data)
		return ports
	}

	return &api.ExposedPorts{}
}

func extractUserSSHPublicKeys(pod *corev1.Pod) []string {
	if data, ok := pod.Annotations[kubernetes.WorkspaceSSHPublicKeys]; ok && len(data) != 0 {
		specPB, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			return nil
		}
		return unmarshalUserSSHPublicKey(specPB)
	}
	return nil
}

func unmarshalUserSSHPublicKey(keys []byte) []string {
	var spec api.SSHPublicKeys
	err := proto.Unmarshal(keys, &spec)
	if err != nil {
		return nil
	}
	return spec.Keys
}
