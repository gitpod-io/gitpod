// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"net/url"
	"sort"

	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	wsapi "github.com/gitpod-io/gitpod/ws-manager/api"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/common"
)

const (
	workspaceIndex = "workspaceIndex"
)

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

// NewCRDWorkspaceInfoProvider creates a fresh WorkspaceInfoProvider.
func NewCRDWorkspaceInfoProvider(client client.Client, scheme *runtime.Scheme) (*CRDWorkspaceInfoProvider, error) {
	// create custom indexer for searches
	indexers := cache.Indexers{
		workspaceIndex: func(obj interface{}) ([]string, error) {
			if workspaceInfo, ok := obj.(*common.WorkspaceInfo); ok {
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
func (r *CRDWorkspaceInfoProvider) WorkspaceInfo(workspaceID string) *common.WorkspaceInfo {
	workspaces, err := r.store.ByIndex(workspaceIndex, workspaceID)
	if err != nil {
		return nil
	}

	if len(workspaces) >= 1 {
		if len(workspaces) != 1 {
			log.Warnf("multiple instances (%d) for workspace %s", len(workspaces), workspaceID)
		}

		sort.Slice(workspaces, func(i, j int) bool {
			a := workspaces[i].(*common.WorkspaceInfo)
			b := workspaces[j].(*common.WorkspaceInfo)

			return a.StartedAt.After(b.StartedAt)
		})

		return workspaces[0].(*common.WorkspaceInfo)
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
	managedByMk2 := true
	if managedBy, ok := ws.Labels[wsk8s.WorkspaceManagedByLabel]; ok && managedBy != "ws-manager-mk2" {
		managedByMk2 = false
	}

	wsinfo := &common.WorkspaceInfo{
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
		OwnerUserId:     ws.Spec.Ownership.Owner,
		SSHPublicKeys:   ws.Spec.SshPublicKeys,
		IsRunning:       ws.Status.Phase == workspacev1.WorkspacePhaseRunning,
		IsEnabledSSHCA:  ws.Spec.SSHGatewayCAPublicKey != "",
		IsManagedByMk2:  managedByMk2,
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
type CompositeInfoProvider []common.WorkspaceInfoProvider

func (c CompositeInfoProvider) WorkspaceInfo(workspaceID string) *common.WorkspaceInfo {
	for _, ip := range c {
		res := ip.WorkspaceInfo(workspaceID)
		if res != nil {
			return res
		}
	}
	return nil
}

type fixedInfoProvider struct {
	Infos map[string]*common.WorkspaceInfo
}

// WorkspaceInfo returns the workspace information of a workspace using it's workspace ID.
func (fp *fixedInfoProvider) WorkspaceInfo(workspaceID string) *common.WorkspaceInfo {
	if fp.Infos == nil {
		return nil
	}
	return fp.Infos[workspaceID]
}
