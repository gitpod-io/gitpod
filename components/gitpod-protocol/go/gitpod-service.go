// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

//go:generate ./generate-mock.sh

package protocol

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/sourcegraph/jsonrpc2"

	"github.com/sirupsen/logrus"
)

// APIInterface wraps the
type APIInterface interface {
	io.Closer

	GetOwnerToken(ctx context.Context, workspaceID string) (res string, err error)
	AdminBlockUser(ctx context.Context, req *AdminBlockUserRequest) (err error)
	GetLoggedInUser(ctx context.Context) (res *User, err error)
	UpdateLoggedInUser(ctx context.Context, user *User) (res *User, err error)
	GetAuthProviders(ctx context.Context) (res []*AuthProviderInfo, err error)
	GetOwnAuthProviders(ctx context.Context) (res []*AuthProviderEntry, err error)
	UpdateOwnAuthProvider(ctx context.Context, params *UpdateOwnAuthProviderParams) (err error)
	DeleteOwnAuthProvider(ctx context.Context, params *DeleteOwnAuthProviderParams) (err error)
	GetConfiguration(ctx context.Context) (res *Configuration, err error)
	GetGitpodTokenScopes(ctx context.Context, tokenHash string) (res []string, err error)
	GetToken(ctx context.Context, query *GetTokenSearchOptions) (res *Token, err error)
	DeleteAccount(ctx context.Context) (err error)
	GetClientRegion(ctx context.Context) (res string, err error)
	GetWorkspaces(ctx context.Context, options *GetWorkspacesOptions) (res []*WorkspaceInfo, err error)
	GetWorkspaceOwner(ctx context.Context, workspaceID string) (res *UserInfo, err error)
	GetWorkspaceUsers(ctx context.Context, workspaceID string) (res []*WorkspaceInstanceUser, err error)
	GetWorkspace(ctx context.Context, id string) (res *WorkspaceInfo, err error)
	GetIDEOptions(ctx context.Context) (res *IDEOptions, err error)
	IsWorkspaceOwner(ctx context.Context, workspaceID string) (res bool, err error)
	CreateWorkspace(ctx context.Context, options *CreateWorkspaceOptions) (res *WorkspaceCreationResult, err error)
	StartWorkspace(ctx context.Context, id string, options *StartWorkspaceOptions) (res *StartWorkspaceResult, err error)
	StopWorkspace(ctx context.Context, id string) (err error)
	DeleteWorkspace(ctx context.Context, id string) (err error)
	SetWorkspaceDescription(ctx context.Context, id string, desc string) (err error)
	ControlAdmission(ctx context.Context, id string, level *AdmissionLevel) (err error)
	UpdateWorkspaceUserPin(ctx context.Context, id string, action *PinAction) (err error)
	SendHeartBeat(ctx context.Context, options *SendHeartBeatOptions) (err error)
	WatchWorkspaceImageBuildLogs(ctx context.Context, workspaceID string) (err error)
	IsPrebuildDone(ctx context.Context, pwsid string) (res bool, err error)
	SetWorkspaceTimeout(ctx context.Context, workspaceID string, duration time.Duration) (res *SetWorkspaceTimeoutResult, err error)
	GetWorkspaceTimeout(ctx context.Context, workspaceID string) (res *GetWorkspaceTimeoutResult, err error)
	GetOpenPorts(ctx context.Context, workspaceID string) (res []*WorkspaceInstancePort, err error)
	OpenPort(ctx context.Context, workspaceID string, port *WorkspaceInstancePort) (res *WorkspaceInstancePort, err error)
	ClosePort(ctx context.Context, workspaceID string, port float32) (err error)
	UpdateGitStatus(ctx context.Context, workspaceID string, status *WorkspaceInstanceRepoStatus) (err error)
	GetWorkspaceEnvVars(ctx context.Context, workspaceID string) (res []*EnvVar, err error)
	GetEnvVars(ctx context.Context) (res []*EnvVar, err error)
	SetEnvVar(ctx context.Context, variable *UserEnvVarValue) (err error)
	DeleteEnvVar(ctx context.Context, variable *UserEnvVarValue) (err error)
	HasSSHPublicKey(ctx context.Context) (res bool, err error)
	GetSSHPublicKeys(ctx context.Context) (res []*UserSSHPublicKeyValue, err error)
	AddSSHPublicKey(ctx context.Context, value *SSHPublicKeyValue) (res *UserSSHPublicKeyValue, err error)
	DeleteSSHPublicKey(ctx context.Context, id string) (err error)
	GetGitpodTokens(ctx context.Context) (res []*APIToken, err error)
	GenerateNewGitpodToken(ctx context.Context, options *GenerateNewGitpodTokenOptions) (res string, err error)
	DeleteGitpodToken(ctx context.Context, tokenHash string) (err error)
	RegisterGithubApp(ctx context.Context, installationID string) (err error)
	TakeSnapshot(ctx context.Context, options *TakeSnapshotOptions) (res string, err error)
	WaitForSnapshot(ctx context.Context, snapshotId string) (err error)
	GetSnapshots(ctx context.Context, workspaceID string) (res []*string, err error)
	GuessGitTokenScopes(ctx context.Context, params *GuessGitTokenScopesParams) (res *GuessedGitTokenScopes, err error)
	TrackEvent(ctx context.Context, event *RemoteTrackMessage) (err error)
	GetSupportedWorkspaceClasses(ctx context.Context) (res []*SupportedWorkspaceClass, err error)

	// Teams
	GetTeam(ctx context.Context, teamID string) (*Team, error)
	GetTeams(ctx context.Context) ([]*Team, error)
	CreateTeam(ctx context.Context, teamName string) (*Team, error)
	DeleteTeam(ctx context.Context, teamID string) error
	GetTeamMembers(ctx context.Context, teamID string) ([]*TeamMemberInfo, error)
	JoinTeam(ctx context.Context, teamID string) (*Team, error)
	GetGenericInvite(ctx context.Context, teamID string) (*TeamMembershipInvite, error)
	ResetGenericInvite(ctx context.Context, teamID string) (*TeamMembershipInvite, error)
	SetTeamMemberRole(ctx context.Context, teamID, userID string, role TeamMemberRole) error
	RemoveTeamMember(ctx context.Context, teamID, userID string) error

	// Organization
	GetOrgSettings(ctx context.Context, orgID string) (*OrganizationSettings, error)

	GetDefaultWorkspaceImage(ctx context.Context, params *GetDefaultWorkspaceImageParams) (res *GetDefaultWorkspaceImageResult, err error)

	// Projects
	CreateProject(ctx context.Context, options *CreateProjectOptions) (*Project, error)
	DeleteProject(ctx context.Context, projectID string) error
	GetTeamProjects(ctx context.Context, teamID string) ([]*Project, error)

	WorkspaceUpdates(ctx context.Context, workspaceID string) (<-chan *WorkspaceInstance, error)

	// GetIDToken doesn't actually do anything, it just authorises
	GetIDToken(ctx context.Context) (err error)
}

// FunctionName is the name of an RPC function
type FunctionName string

const (
	// FunctionGetOwnerToken is the name of the getOwnerToken function
	FunctionGetOwnerToken FunctionName = "getOwnerToken"
	// FunctionAdminBlockUser is the name of the adminBlockUser function
	FunctionAdminBlockUser FunctionName = "adminBlockUser"
	// FunctionGetLoggedInUser is the name of the getLoggedInUser function
	FunctionGetLoggedInUser FunctionName = "getLoggedInUser"
	// FunctionUpdateLoggedInUser is the name of the updateLoggedInUser function
	FunctionUpdateLoggedInUser FunctionName = "updateLoggedInUser"
	// FunctionGetAuthProviders is the name of the getAuthProviders function
	FunctionGetAuthProviders FunctionName = "getAuthProviders"
	// FunctionGetOwnAuthProviders is the name of the getOwnAuthProviders function
	FunctionGetOwnAuthProviders FunctionName = "getOwnAuthProviders"
	// FunctionUpdateOwnAuthProvider is the name of the updateOwnAuthProvider function
	FunctionUpdateOwnAuthProvider FunctionName = "updateOwnAuthProvider"
	// FunctionDeleteOwnAuthProvider is the name of the deleteOwnAuthProvider function
	FunctionDeleteOwnAuthProvider FunctionName = "deleteOwnAuthProvider"
	// FunctionGetConfiguration is the name of the getConfiguration function
	FunctionGetConfiguration FunctionName = "getConfiguration"
	// FunctionGetGitpodTokenScopes is the name of the GetGitpodTokenScopes function
	FunctionGetGitpodTokenScopes FunctionName = "getGitpodTokenScopes"
	// FunctionGetToken is the name of the getToken function
	FunctionGetToken FunctionName = "getToken"
	// FunctionDeleteAccount is the name of the deleteAccount function
	FunctionDeleteAccount FunctionName = "deleteAccount"
	// FunctionGetClientRegion is the name of the getClientRegion function
	FunctionGetClientRegion FunctionName = "getClientRegion"
	// FunctionGetWorkspaces is the name of the getWorkspaces function
	FunctionGetWorkspaces FunctionName = "getWorkspaces"
	// FunctionGetWorkspaceOwner is the name of the getWorkspaceOwner function
	FunctionGetWorkspaceOwner FunctionName = "getWorkspaceOwner"
	// FunctionGetWorkspaceUsers is the name of the getWorkspaceUsers function
	FunctionGetWorkspaceUsers FunctionName = "getWorkspaceUsers"
	// FunctionGetWorkspace is the name of the getWorkspace function
	FunctionGetWorkspace FunctionName = "getWorkspace"
	// FunctionGetIDEOptions is the name of the getIDEOptions function
	FunctionGetIDEOptions FunctionName = "getIDEOptions"
	// FunctionIsWorkspaceOwner is the name of the isWorkspaceOwner function
	FunctionIsWorkspaceOwner FunctionName = "isWorkspaceOwner"
	// FunctionCreateWorkspace is the name of the createWorkspace function
	FunctionCreateWorkspace FunctionName = "createWorkspace"
	// FunctionStartWorkspace is the name of the startWorkspace function
	FunctionStartWorkspace FunctionName = "startWorkspace"
	// FunctionStopWorkspace is the name of the stopWorkspace function
	FunctionStopWorkspace FunctionName = "stopWorkspace"
	// FunctionDeleteWorkspace is the name of the deleteWorkspace function
	FunctionDeleteWorkspace FunctionName = "deleteWorkspace"
	// FunctionSetWorkspaceDescription is the name of the setWorkspaceDescription function
	FunctionSetWorkspaceDescription FunctionName = "setWorkspaceDescription"
	// FunctionControlAdmission is the name of the controlAdmission function
	FunctionControlAdmission FunctionName = "controlAdmission"
	// FunctionUpdateWorkspaceUserPin is the name of the updateWorkspaceUserPin function
	FunctionUpdateWorkspaceUserPin FunctionName = "updateWorkspaceUserPin"
	// FunctionSendHeartBeat is the name of the sendHeartBeat function
	FunctionSendHeartBeat FunctionName = "sendHeartBeat"
	// FunctionWatchWorkspaceImageBuildLogs is the name of the watchWorkspaceImageBuildLogs function
	FunctionWatchWorkspaceImageBuildLogs FunctionName = "watchWorkspaceImageBuildLogs"
	// FunctionIsPrebuildDone is the name of the isPrebuildDone function
	FunctionIsPrebuildDone FunctionName = "isPrebuildDone"
	// FunctionSetWorkspaceTimeout is the name of the setWorkspaceTimeout function
	FunctionSetWorkspaceTimeout FunctionName = "setWorkspaceTimeout"
	// FunctionGetWorkspaceTimeout is the name of the getWorkspaceTimeout function
	FunctionGetWorkspaceTimeout FunctionName = "getWorkspaceTimeout"
	// FunctionGetOpenPorts is the name of the getOpenPorts function
	FunctionGetOpenPorts FunctionName = "getOpenPorts"
	// FunctionOpenPort is the name of the openPort function
	FunctionOpenPort FunctionName = "openPort"
	// FunctionClosePort is the name of the closePort function
	FunctionClosePort FunctionName = "closePort"
	// FunctionGetEnvVars is the name of the getEnvVars function
	FunctionGetEnvVars FunctionName = "getEnvVars"
	// FunctionSetEnvVar is the name of the setEnvVar function
	FunctionSetEnvVar FunctionName = "setEnvVar"
	// FunctionDeleteEnvVar is the name of the deleteEnvVar function
	FunctionDeleteEnvVar FunctionName = "deleteEnvVar"
	// FunctionHasSSHPublicKey is the name of the hasSSHPublicKey function
	FunctionHasSSHPublicKey FunctionName = "hasSSHPublicKey"
	// FunctionGetSSHPublicKeys is the name of the getSSHPublicKeys function
	FunctionGetSSHPublicKeys FunctionName = "getSSHPublicKeys"
	// FunctionAddSSHPublicKey is the name of the addSSHPublicKey function
	FunctionAddSSHPublicKey FunctionName = "addSSHPublicKey"
	// FunctionDeleteSSHPublicKey is the name of the deleteSSHPublicKey function
	FunctionDeleteSSHPublicKey FunctionName = "deleteSSHPublicKey"
	// FunctionGetGitpodTokens is the name of the getGitpodTokens function
	FunctionGetGitpodTokens FunctionName = "getGitpodTokens"
	// FunctionGenerateNewGitpodToken is the name of the generateNewGitpodToken function
	FunctionGenerateNewGitpodToken FunctionName = "generateNewGitpodToken"
	// FunctionDeleteGitpodToken is the name of the deleteGitpodToken function
	FunctionDeleteGitpodToken FunctionName = "deleteGitpodToken"
	// FunctionRegisterGithubApp is the name of the registerGithubApp function
	FunctionRegisterGithubApp FunctionName = "registerGithubApp"
	// FunctionTakeSnapshot is the name of the takeSnapshot function
	FunctionTakeSnapshot FunctionName = "takeSnapshot"
	// FunctionGetSnapshots is the name of the getSnapshots function
	FunctionGetSnapshots FunctionName = "getSnapshots"
	// FunctionGuessGitTokenScopes is the name of the guessGitTokenScopes function
	FunctionGuessGitTokenScope FunctionName = "guessGitTokenScopes"
	// FunctionTrackEvent is the name of the trackEvent function
	FunctionTrackEvent FunctionName = "trackEvent"
	// FunctionGetSupportedWorkspaceClasses is the name of the getSupportedWorkspaceClasses function
	FunctionGetSupportedWorkspaceClasses FunctionName = "getSupportedWorkspaceClasses"

	// Teams
	// FunctionGetTeam is the name of the getTeam function
	FunctionGetTeam FunctionName = "getTeam"
	// FunctionGetTeams is the name of the getTeams function
	FunctionGetTeams FunctionName = "getTeams"
	// FunctionCreateTeam is the name of the createTeam function
	FunctionCreateTeam FunctionName = "createTeam"
	// FunctionJoinTeam is the name of the joinTeam function
	FunctionJoinTeam FunctionName = "joinTeam"
	// FunctionGetTeamMembers is the name of the getTeamMembers function
	FunctionGetTeamMembers FunctionName = "getTeamMembers"
	// FunctionGetGenericInvite is the name of the getGenericInvite function
	FunctionGetGenericInvite FunctionName = "getGenericInvite"
	// FunctionResetGenericInvite is the name of the resetGenericInvite function
	FunctionResetGenericInvite FunctionName = "resetGenericInvite"
	// FunctionSetTeamMemberRole is the name of the setTeamMemberRole function
	FunctionSetTeamMemberRole FunctionName = "setTeamMemberRole"
	// FunctionRemoveTeamMember is the name of the removeTeamMember function
	FunctionRemoveTeamMember FunctionName = "removeTeamMember"
	// FunctionDeleteTeam is the name of the deleteTeam function
	FunctionDeleteTeam FunctionName = "deleteTeam"

	// Organizations
	// FunctionGetOrgSettings is the name of the getOrgSettings function
	FunctionGetOrgSettings FunctionName = "getOrgSettings"

	// FunctionGetDefaultWorkspaceImage is the name of the getDefaultWorkspaceImage function
	FunctionGetDefaultWorkspaceImage FunctionName = "getDefaultWorkspaceImage"

	// Projects
	FunctionCreateProject   FunctionName = "createProject"
	FunctionDeleteProject   FunctionName = "deleteProject"
	FunctionGetTeamProjects FunctionName = "getTeamProjects"

	// FunctionOnInstanceUpdate is the name of the onInstanceUpdate callback function
	FunctionOnInstanceUpdate = "onInstanceUpdate"

	FunctionGetIDToken FunctionName = "getIDToken"
)

var errNotConnected = errors.New("not connected to Gitpod server")

// ConnectToServerOpts configures the server connection
type ConnectToServerOpts struct {
	Context             context.Context
	Token               string
	Cookie              string
	Origin              string
	Log                 *logrus.Entry
	ReconnectionHandler func()
	CloseHandler        func(error)
	ExtraHeaders        map[string]string
}

// ConnectToServer establishes a new websocket connection to the server
func ConnectToServer(endpoint string, opts ConnectToServerOpts) (*APIoverJSONRPC, error) {
	if opts.Context == nil {
		opts.Context = context.Background()
	}

	reqHeader := http.Header{}
	reqHeader.Set("Origin", opts.Origin)

	for k, v := range opts.ExtraHeaders {
		reqHeader.Set(k, v)
	}
	if opts.Token != "" {
		reqHeader.Set("Authorization", "Bearer "+opts.Token)
	}

	if opts.Cookie != "" {
		reqHeader.Set("Cookie", opts.Cookie)
	}

	ws := NewReconnectingWebsocket(endpoint, reqHeader, opts.Log)
	ws.ReconnectionHandler = opts.ReconnectionHandler
	go func() {
		err := ws.Dial(opts.Context)
		if opts.CloseHandler != nil {
			opts.CloseHandler(err)
		}
	}()

	var res APIoverJSONRPC
	res.log = opts.Log
	res.C = jsonrpc2.NewConn(opts.Context, ws, jsonrpc2.HandlerWithError(res.handler))
	return &res, nil
}

// APIoverJSONRPC makes JSON RPC calls to the Gitpod server is the APIoverJSONRPC message type
type APIoverJSONRPC struct {
	C   jsonrpc2.JSONRPC2
	log *logrus.Entry

	mu            sync.RWMutex
	workspaceSubs map[string]map[chan *WorkspaceInstance]struct{}
}

// Close closes the connection
func (gp *APIoverJSONRPC) Close() (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	e1 := gp.C.Close()
	if e1 != nil {
		return e1
	}
	return nil
}

// WorkspaceUpdates subscribes to workspace instance updates until the context is canceled
func (gp *APIoverJSONRPC) WorkspaceUpdates(ctx context.Context, workspaceID string) (<-chan *WorkspaceInstance, error) {
	if gp == nil {
		return nil, errNotConnected
	}
	chn := make(chan *WorkspaceInstance)

	gp.mu.Lock()
	if gp.workspaceSubs == nil {
		gp.workspaceSubs = make(map[string]map[chan *WorkspaceInstance]struct{})
	}
	if sub, ok := gp.workspaceSubs[workspaceID]; ok {
		sub[chn] = struct{}{}
	} else {
		gp.workspaceSubs[workspaceID] = map[chan *WorkspaceInstance]struct{}{chn: {}}
	}
	gp.mu.Unlock()

	go func() {
		<-ctx.Done()

		gp.mu.Lock()
		delete(gp.workspaceSubs[workspaceID], chn)
		close(chn)
		gp.mu.Unlock()
	}()

	return chn, nil
}

func (gp *APIoverJSONRPC) handler(ctx context.Context, conn *jsonrpc2.Conn, req *jsonrpc2.Request) (result interface{}, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	if req.Method != FunctionOnInstanceUpdate {
		return
	}

	var instance WorkspaceInstance
	err = json.Unmarshal(*req.Params, &instance)
	if err != nil {
		gp.log.WithError(err).WithField("raw", string(*req.Params)).Error("cannot unmarshal instance update")
		return
	}

	gp.mu.RLock()
	defer gp.mu.RUnlock()
	for chn := range gp.workspaceSubs[instance.WorkspaceID] {
		select {
		case chn <- &instance:
		default:
		}
	}
	for chn := range gp.workspaceSubs[""] {
		select {
		case chn <- &instance:
		default:
		}
	}

	return
}

func (gp *APIoverJSONRPC) GetOwnerToken(ctx context.Context, workspaceID string) (res string, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}
	_params = append(_params, workspaceID)

	var _result string
	err = gp.C.Call(ctx, "getOwnerToken", _params, &_result)
	if err != nil {
		return "", err
	}
	res = _result
	return
}

// AdminBlockUser calls adminBlockUser on the server
func (gp *APIoverJSONRPC) AdminBlockUser(ctx context.Context, message *AdminBlockUserRequest) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}
	_params = append(_params, message)

	var _result interface{}
	err = gp.C.Call(ctx, "adminBlockUser", _params, &_result)
	if err != nil {
		return err
	}
	return
}

// AdminVerifyUser calls adminVerifyUser on the server
func (gp *APIoverJSONRPC) AdminVerifyUser(ctx context.Context, userId string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}
	_params = append(_params, userId)

	var _result interface{}
	err = gp.C.Call(ctx, "adminVerifyUser", _params, &_result)
	if err != nil {
		return err
	}
	return
}

// GetLoggedInUser calls getLoggedInUser on the server
func (gp *APIoverJSONRPC) GetLoggedInUser(ctx context.Context) (res *User, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	var result User
	err = gp.C.Call(ctx, "getLoggedInUser", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// UpdateLoggedInUser calls updateLoggedInUser on the server
func (gp *APIoverJSONRPC) UpdateLoggedInUser(ctx context.Context, user *User) (res *User, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, user)

	var result User
	err = gp.C.Call(ctx, "updateLoggedInUser", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// GetAuthProviders calls getAuthProviders on the server
func (gp *APIoverJSONRPC) GetAuthProviders(ctx context.Context) (res []*AuthProviderInfo, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	var result []*AuthProviderInfo
	err = gp.C.Call(ctx, "getAuthProviders", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// GetOwnAuthProviders calls getOwnAuthProviders on the server
func (gp *APIoverJSONRPC) GetOwnAuthProviders(ctx context.Context) (res []*AuthProviderEntry, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	var result []*AuthProviderEntry
	err = gp.C.Call(ctx, "getOwnAuthProviders", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// UpdateOwnAuthProvider calls updateOwnAuthProvider on the server
func (gp *APIoverJSONRPC) UpdateOwnAuthProvider(ctx context.Context, params *UpdateOwnAuthProviderParams) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, params)

	err = gp.C.Call(ctx, "updateOwnAuthProvider", _params, nil)
	if err != nil {
		return
	}

	return
}

// DeleteOwnAuthProvider calls deleteOwnAuthProvider on the server
func (gp *APIoverJSONRPC) DeleteOwnAuthProvider(ctx context.Context, params *DeleteOwnAuthProviderParams) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, params)

	err = gp.C.Call(ctx, "deleteOwnAuthProvider", _params, nil)
	if err != nil {
		return
	}

	return
}

// GetConfiguration calls getConfiguration on the server
func (gp *APIoverJSONRPC) GetConfiguration(ctx context.Context) (res *Configuration, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	var result Configuration
	err = gp.C.Call(ctx, "getConfiguration", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// GetGitpodTokenScopes calls getGitpodTokenScopes on the server
func (gp *APIoverJSONRPC) GetGitpodTokenScopes(ctx context.Context, tokenHash string) (res []string, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, tokenHash)

	var result []string
	err = gp.C.Call(ctx, "getGitpodTokenScopes", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// GetToken calls getToken on the server
func (gp *APIoverJSONRPC) GetToken(ctx context.Context, query *GetTokenSearchOptions) (res *Token, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, query)

	var result Token
	err = gp.C.Call(ctx, "getToken", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// DeleteAccount calls deleteAccount on the server
func (gp *APIoverJSONRPC) DeleteAccount(ctx context.Context) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	err = gp.C.Call(ctx, "deleteAccount", _params, nil)
	if err != nil {
		return
	}

	return
}

// GetClientRegion calls getClientRegion on the server
func (gp *APIoverJSONRPC) GetClientRegion(ctx context.Context) (res string, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	var result string
	err = gp.C.Call(ctx, "getClientRegion", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// GetWorkspaces calls getWorkspaces on the server
func (gp *APIoverJSONRPC) GetWorkspaces(ctx context.Context, options *GetWorkspacesOptions) (res []*WorkspaceInfo, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, options)

	var result []*WorkspaceInfo
	err = gp.C.Call(ctx, "getWorkspaces", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// GetWorkspaceOwner calls getWorkspaceOwner on the server
func (gp *APIoverJSONRPC) GetWorkspaceOwner(ctx context.Context, workspaceID string) (res *UserInfo, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)

	var result UserInfo
	err = gp.C.Call(ctx, "getWorkspaceOwner", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// GetWorkspaceUsers calls getWorkspaceUsers on the server
func (gp *APIoverJSONRPC) GetWorkspaceUsers(ctx context.Context, workspaceID string) (res []*WorkspaceInstanceUser, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)

	var result []*WorkspaceInstanceUser
	err = gp.C.Call(ctx, "getWorkspaceUsers", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// GetWorkspace calls getWorkspace on the server
func (gp *APIoverJSONRPC) GetWorkspace(ctx context.Context, id string) (res *WorkspaceInfo, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, id)

	var result WorkspaceInfo
	err = gp.C.Call(ctx, "getWorkspace", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// GetIDEOptions calls getIDEOptions on the server
func (gp *APIoverJSONRPC) GetIDEOptions(ctx context.Context) (res *IDEOptions, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	var result IDEOptions
	err = gp.C.Call(ctx, "getIDEOptions", _params, &result)
	if err != nil {
		return
	}

	res = &result

	return
}

// IsWorkspaceOwner calls isWorkspaceOwner on the server
func (gp *APIoverJSONRPC) IsWorkspaceOwner(ctx context.Context, workspaceID string) (res bool, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)

	var result bool
	err = gp.C.Call(ctx, "isWorkspaceOwner", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// CreateWorkspace calls createWorkspace on the server
func (gp *APIoverJSONRPC) CreateWorkspace(ctx context.Context, options *CreateWorkspaceOptions) (res *WorkspaceCreationResult, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, options)

	var result WorkspaceCreationResult
	err = gp.C.Call(ctx, "createWorkspace", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// StartWorkspace calls startWorkspace on the server
func (gp *APIoverJSONRPC) StartWorkspace(ctx context.Context, id string, options *StartWorkspaceOptions) (res *StartWorkspaceResult, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, id)
	_params = append(_params, options)

	var result StartWorkspaceResult
	err = gp.C.Call(ctx, "startWorkspace", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// StopWorkspace calls stopWorkspace on the server
func (gp *APIoverJSONRPC) StopWorkspace(ctx context.Context, id string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, id)

	err = gp.C.Call(ctx, "stopWorkspace", _params, nil)
	if err != nil {
		return
	}

	return
}

// DeleteWorkspace calls deleteWorkspace on the server
func (gp *APIoverJSONRPC) DeleteWorkspace(ctx context.Context, id string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, id)

	err = gp.C.Call(ctx, "deleteWorkspace", _params, nil)
	if err != nil {
		return
	}

	return
}

// SetWorkspaceDescription calls setWorkspaceDescription on the server
func (gp *APIoverJSONRPC) SetWorkspaceDescription(ctx context.Context, id string, desc string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, id)
	_params = append(_params, desc)

	err = gp.C.Call(ctx, "setWorkspaceDescription", _params, nil)
	if err != nil {
		return
	}

	return
}

// ControlAdmission calls controlAdmission on the server
func (gp *APIoverJSONRPC) ControlAdmission(ctx context.Context, id string, level *AdmissionLevel) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, id)
	_params = append(_params, level)

	err = gp.C.Call(ctx, "controlAdmission", _params, nil)
	if err != nil {
		return
	}

	return
}

// WatchWorkspaceImageBuildLogs calls watchWorkspaceImageBuildLogs on the server
func (gp *APIoverJSONRPC) WatchWorkspaceImageBuildLogs(ctx context.Context, workspaceID string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)

	err = gp.C.Call(ctx, "watchWorkspaceImageBuildLogs", _params, nil)
	if err != nil {
		return
	}

	return
}

// IsPrebuildDone calls isPrebuildDone on the server
func (gp *APIoverJSONRPC) IsPrebuildDone(ctx context.Context, pwsid string) (res bool, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, pwsid)

	var result bool
	err = gp.C.Call(ctx, "isPrebuildDone", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// SetWorkspaceTimeout calls setWorkspaceTimeout on the server
func (gp *APIoverJSONRPC) SetWorkspaceTimeout(ctx context.Context, workspaceID string, duration time.Duration) (res *SetWorkspaceTimeoutResult, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)
	_params = append(_params, fmt.Sprintf("%dm", int(duration.Minutes())))

	var result SetWorkspaceTimeoutResult
	err = gp.C.Call(ctx, "setWorkspaceTimeout", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// GetWorkspaceTimeout calls getWorkspaceTimeout on the server
func (gp *APIoverJSONRPC) GetWorkspaceTimeout(ctx context.Context, workspaceID string) (res *GetWorkspaceTimeoutResult, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)

	var result GetWorkspaceTimeoutResult
	err = gp.C.Call(ctx, "getWorkspaceTimeout", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// SendHeartBeat calls sendHeartBeat on the server
func (gp *APIoverJSONRPC) SendHeartBeat(ctx context.Context, options *SendHeartBeatOptions) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, options)

	err = gp.C.Call(ctx, "sendHeartBeat", _params, nil)
	if err != nil {
		return
	}

	return
}

// UpdateWorkspaceUserPin calls updateWorkspaceUserPin on the server
func (gp *APIoverJSONRPC) UpdateWorkspaceUserPin(ctx context.Context, id string, action *PinAction) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, id)
	_params = append(_params, action)

	err = gp.C.Call(ctx, "updateWorkspaceUserPin", _params, nil)
	if err != nil {
		return
	}

	return
}

// GetOpenPorts calls getOpenPorts on the server
func (gp *APIoverJSONRPC) GetOpenPorts(ctx context.Context, workspaceID string) (res []*WorkspaceInstancePort, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)

	var result []*WorkspaceInstancePort
	err = gp.C.Call(ctx, "getOpenPorts", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// OpenPort calls openPort on the server
func (gp *APIoverJSONRPC) OpenPort(ctx context.Context, workspaceID string, port *WorkspaceInstancePort) (res *WorkspaceInstancePort, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)
	_params = append(_params, port)

	var result WorkspaceInstancePort
	err = gp.C.Call(ctx, "openPort", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// ClosePort calls closePort on the server
func (gp *APIoverJSONRPC) ClosePort(ctx context.Context, workspaceID string, port float32) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)
	_params = append(_params, port)

	err = gp.C.Call(ctx, "closePort", _params, nil)
	if err != nil {
		return
	}

	return
}

// UpdateGitStatus calls UpdateGitStatus on the server
func (gp *APIoverJSONRPC) UpdateGitStatus(ctx context.Context, workspaceID string, status *WorkspaceInstanceRepoStatus) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}
	_params = append(_params, workspaceID)
	_params = append(_params, status)

	err = gp.C.Call(ctx, "updateGitStatus", _params, nil)
	if err != nil {
		return
	}

	return
}

// GetWorkspaceEnvVars calls GetWorkspaceEnvVars on the server
func (gp *APIoverJSONRPC) GetWorkspaceEnvVars(ctx context.Context, workspaceID string) (res []*EnvVar, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)

	var result []*EnvVar
	err = gp.C.Call(ctx, "getWorkspaceEnvVars", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// GetEnvVars calls getEnvVars on the server
func (gp *APIoverJSONRPC) GetEnvVars(ctx context.Context) (res []*EnvVar, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	var result []*EnvVar
	err = gp.C.Call(ctx, "getEnvVars", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// SetEnvVar calls setEnvVar on the server
func (gp *APIoverJSONRPC) SetEnvVar(ctx context.Context, variable *UserEnvVarValue) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, variable)

	err = gp.C.Call(ctx, "setEnvVar", _params, nil)
	if err != nil {
		return
	}

	return
}

// DeleteEnvVar calls deleteEnvVar on the server
func (gp *APIoverJSONRPC) DeleteEnvVar(ctx context.Context, variable *UserEnvVarValue) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, variable)

	err = gp.C.Call(ctx, "deleteEnvVar", _params, nil)
	if err != nil {
		return
	}

	return
}

// HasSSHPublicKey calls hasSSHPublicKey on the server
func (gp *APIoverJSONRPC) HasSSHPublicKey(ctx context.Context) (res bool, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}
	err = gp.C.Call(ctx, "hasSSHPublicKey", _params, &res)
	return
}

// GetSSHPublicKeys calls getSSHPublicKeys on the server
func (gp *APIoverJSONRPC) GetSSHPublicKeys(ctx context.Context) (res []*UserSSHPublicKeyValue, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}
	err = gp.C.Call(ctx, "getSSHPublicKeys", _params, &res)
	return
}

// AddSSHPublicKey calls addSSHPublicKey on the server
func (gp *APIoverJSONRPC) AddSSHPublicKey(ctx context.Context, value *SSHPublicKeyValue) (res *UserSSHPublicKeyValue, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{value}
	err = gp.C.Call(ctx, "addSSHPublicKey", _params, &res)
	return
}

// DeleteSSHPublicKey calls deleteSSHPublicKey on the server
func (gp *APIoverJSONRPC) DeleteSSHPublicKey(ctx context.Context, id string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{id}
	err = gp.C.Call(ctx, "deleteSSHPublicKey", _params, nil)
	return
}

// GetGitpodTokens calls getGitpodTokens on the server
func (gp *APIoverJSONRPC) GetGitpodTokens(ctx context.Context) (res []*APIToken, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	var result []*APIToken
	err = gp.C.Call(ctx, "getGitpodTokens", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// GenerateNewGitpodToken calls generateNewGitpodToken on the server
func (gp *APIoverJSONRPC) GenerateNewGitpodToken(ctx context.Context, options *GenerateNewGitpodTokenOptions) (res string, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, options)

	var result string
	err = gp.C.Call(ctx, "generateNewGitpodToken", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// DeleteGitpodToken calls deleteGitpodToken on the server
func (gp *APIoverJSONRPC) DeleteGitpodToken(ctx context.Context, tokenHash string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, tokenHash)

	err = gp.C.Call(ctx, "deleteGitpodToken", _params, nil)
	if err != nil {
		return
	}

	return
}

// RegisterGithubApp calls registerGithubApp on the server
func (gp *APIoverJSONRPC) RegisterGithubApp(ctx context.Context, installationID string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, installationID)

	err = gp.C.Call(ctx, "registerGithubApp", _params, nil)
	if err != nil {
		return
	}

	return
}

// TakeSnapshot calls takeSnapshot on the server
func (gp *APIoverJSONRPC) TakeSnapshot(ctx context.Context, options *TakeSnapshotOptions) (res string, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, options)

	var result string
	err = gp.C.Call(ctx, "takeSnapshot", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// WaitForSnapshot calls waitForSnapshot on the server
func (gp *APIoverJSONRPC) WaitForSnapshot(ctx context.Context, snapshotId string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, snapshotId)

	var result string
	err = gp.C.Call(ctx, "waitForSnapshot", _params, &result)
	return
}

// GetSnapshots calls getSnapshots on the server
func (gp *APIoverJSONRPC) GetSnapshots(ctx context.Context, workspaceID string) (res []*string, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, workspaceID)

	var result []*string
	err = gp.C.Call(ctx, "getSnapshots", _params, &result)
	if err != nil {
		return
	}
	res = result

	return
}

// GuessGitTokenScopes calls GuessGitTokenScopes on the server
func (gp *APIoverJSONRPC) GuessGitTokenScopes(ctx context.Context, params *GuessGitTokenScopesParams) (res *GuessedGitTokenScopes, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, params)

	var result GuessedGitTokenScopes
	err = gp.C.Call(ctx, "guessGitTokenScopes", _params, &result)
	if err != nil {
		return
	}
	res = &result

	return
}

// TrackEvent calls trackEvent on the server
func (gp *APIoverJSONRPC) TrackEvent(ctx context.Context, params *RemoteTrackMessage) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, params)
	err = gp.C.Call(ctx, "trackEvent", _params, nil)
	return
}

func (gp *APIoverJSONRPC) GetSupportedWorkspaceClasses(ctx context.Context) (res []*SupportedWorkspaceClass, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{}
	err = gp.C.Call(ctx, "getSupportedWorkspaceClasses", _params, &res)
	return
}

func (gp *APIoverJSONRPC) GetTeam(ctx context.Context, teamID string) (res *Team, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamID}
	err = gp.C.Call(ctx, string(FunctionGetTeam), _params, &res)
	return
}

func (gp *APIoverJSONRPC) GetTeams(ctx context.Context) (res []*Team, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{}
	err = gp.C.Call(ctx, string(FunctionGetTeams), _params, &res)
	return
}

func (gp *APIoverJSONRPC) CreateTeam(ctx context.Context, teamName string) (res *Team, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamName}
	err = gp.C.Call(ctx, string(FunctionCreateTeam), _params, &res)
	return
}

func (gp *APIoverJSONRPC) GetTeamMembers(ctx context.Context, teamID string) (res []*TeamMemberInfo, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamID}
	err = gp.C.Call(ctx, string(FunctionGetTeamMembers), _params, &res)
	return
}

func (gp *APIoverJSONRPC) JoinTeam(ctx context.Context, inviteID string) (res *Team, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{inviteID}
	err = gp.C.Call(ctx, string(FunctionJoinTeam), _params, &res)
	return
}

func (gp *APIoverJSONRPC) GetGenericInvite(ctx context.Context, teamID string) (res *TeamMembershipInvite, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamID}
	err = gp.C.Call(ctx, string(FunctionGetGenericInvite), _params, &res)
	return
}

func (gp *APIoverJSONRPC) ResetGenericInvite(ctx context.Context, teamID string) (res *TeamMembershipInvite, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamID}
	err = gp.C.Call(ctx, string(FunctionResetGenericInvite), _params, &res)
	return
}

func (gp *APIoverJSONRPC) SetTeamMemberRole(ctx context.Context, teamID, userID string, role TeamMemberRole) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamID, userID, role}
	err = gp.C.Call(ctx, string(FunctionSetTeamMemberRole), _params, nil)
	return
}

func (gp *APIoverJSONRPC) RemoveTeamMember(ctx context.Context, teamID, userID string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamID, userID}
	err = gp.C.Call(ctx, string(FunctionRemoveTeamMember), _params, nil)
	return
}

func (gp *APIoverJSONRPC) DeleteTeam(ctx context.Context, teamID string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamID}
	err = gp.C.Call(ctx, string(FunctionDeleteTeam), _params, nil)
	return
}

func (gp *APIoverJSONRPC) GetOrgSettings(ctx context.Context, orgID string) (res *OrganizationSettings, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{orgID}
	err = gp.C.Call(ctx, string(FunctionGetOrgSettings), _params, &res)
	return
}

func (gp *APIoverJSONRPC) GetDefaultWorkspaceImage(ctx context.Context, params *GetDefaultWorkspaceImageParams) (res *GetDefaultWorkspaceImageResult, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	var _params []interface{}

	_params = append(_params, params)

	err = gp.C.Call(ctx, string(FunctionGetDefaultWorkspaceImage), _params, &res)
	return
}

func (gp *APIoverJSONRPC) CreateProject(ctx context.Context, options *CreateProjectOptions) (res *Project, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{options}
	err = gp.C.Call(ctx, string(FunctionCreateProject), _params, &res)
	return
}

func (gp *APIoverJSONRPC) DeleteProject(ctx context.Context, projectID string) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{projectID}
	err = gp.C.Call(ctx, string(FunctionDeleteProject), _params, nil)
	return
}

func (gp *APIoverJSONRPC) GetTeamProjects(ctx context.Context, teamID string) (res []*Project, err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{teamID}
	err = gp.C.Call(ctx, string(FunctionGetTeamProjects), _params, &res)
	return
}

func (gp *APIoverJSONRPC) GetIDToken(ctx context.Context) (err error) {
	if gp == nil {
		err = errNotConnected
		return
	}
	_params := []interface{}{}
	err = gp.C.Call(ctx, string(FunctionGetIDToken), _params, nil)
	return
}

// PermissionName is the name of a permission
type PermissionName string

const (
	// PermissionNameRegistryAccess is the "registry-access" permission
	PermissionNameRegistryAccess PermissionName = "registry-access"
	// PermissionNameAdminUsers is the "admin-users" permission
	PermissionNameAdminUsers PermissionName = "admin-users"
	// PermissionNameAdminWorkspaces is the "admin-workspaces" permission
	PermissionNameAdminWorkspaces PermissionName = "admin-workspaces"
)

// AdmissionLevel is the admission level to a workspace
type AdmissionLevel string

const (
	// AdmissionLevelOwner is the "owner" admission level
	AdmissionLevelOwner AdmissionLevel = "owner"
	// AdmissionLevelEveryone is the "everyone" admission level
	AdmissionLevelEveryone AdmissionLevel = "everyone"
)

// PinAction is the pin action
type PinAction string

const (
	// PinActionPin is the "pin" action
	PinActionPin PinAction = "pin"
	// PinActionUnpin is the "unpin" action
	PinActionUnpin PinAction = "unpin"
	// PinActionToggle is the "toggle" action
	PinActionToggle PinAction = "toggle"
)

// UserInfo is the UserInfo message type
type UserInfo struct {
	Name string `json:"name,omitempty"`
}

// GetWorkspacesOptions is the GetWorkspacesOptions message type
type GetWorkspacesOptions struct {
	Limit          float64 `json:"limit,omitempty"`
	SearchString   string  `json:"searchString,omitempty"`
	PinnedOnly     bool    `json:"pinnedOnly,omitempty"`
	OrganizationId string  `json:"organizationId,omitempty"`
}

// StartWorkspaceResult is the StartWorkspaceResult message type
type StartWorkspaceResult struct {
	InstanceID   string `json:"instanceID,omitempty"`
	WorkspaceURL string `json:"workspaceURL,omitempty"`
}

// APIToken is the APIToken message type
type APIToken struct {

	// Created timestamp
	Created string `json:"created,omitempty"`
	Deleted bool   `json:"deleted,omitempty"`

	// Human readable name of the token
	Name string `json:"name,omitempty"`

	// Scopes (e.g. limition to read-only)
	Scopes []string `json:"scopes,omitempty"`

	// Hash value (SHA256) of the token (primary key).
	TokenHash string `json:"tokenHash,omitempty"`

	// // Token kindfloat64 is the float64 message type
	Type float64 `json:"type,omitempty"`

	// The user the token belongs to.
	User *User `json:"user,omitempty"`
}

// OAuth2Config is the OAuth2Config message type
type OAuth2Config struct {
	AuthorizationParams map[string]string `json:"authorizationParams,omitempty"`
	AuthorizationURL    string            `json:"authorizationUrl,omitempty"`
	CallBackURL         string            `json:"callBackUrl,omitempty"`
	ClientID            string            `json:"clientId,omitempty"`
	ClientSecret        string            `json:"clientSecret,omitempty"`
	ConfigURL           string            `json:"configURL,omitempty"`
	Scope               string            `json:"scope,omitempty"`
	ScopeSeparator      string            `json:"scopeSeparator,omitempty"`
	SettingsURL         string            `json:"settingsUrl,omitempty"`
	TokenURL            string            `json:"tokenUrl,omitempty"`
}

// AuthProviderEntry is the AuthProviderEntry message type
type AuthProviderEntry struct {
	Host    string        `json:"host,omitempty"`
	ID      string        `json:"id,omitempty"`
	Oauth   *OAuth2Config `json:"oauth,omitempty"`
	OwnerID string        `json:"ownerId,omitempty"`

	// Status  string        `json:"status,omitempty"`   string is the    string message type
	Type string `json:"type,omitempty"`
}

// Commit is the Commit message type
type Commit struct {
	Ref        string      `json:"ref,omitempty"`
	RefType    string      `json:"refType,omitempty"`
	Repository *Repository `json:"repository,omitempty"`
	Revision   string      `json:"revision,omitempty"`
}

// Fork is the Fork message type
type Fork struct {
	Parent *Repository `json:"parent,omitempty"`
}

// Repository is the Repository message type
type Repository struct {
	AvatarURL     string `json:"avatarUrl,omitempty"`
	CloneURL      string `json:"cloneUrl,omitempty"`
	DefaultBranch string `json:"defaultBranch,omitempty"`
	Description   string `json:"description,omitempty"`
	Fork          *Fork  `json:"fork,omitempty"`
	Host          string `json:"host,omitempty"`
	Name          string `json:"name,omitempty"`
	Owner         string `json:"owner,omitempty"`

	// Optional for backwards compatibility
	Private bool   `json:"private,omitempty"`
	WebURL  string `json:"webUrl,omitempty"`
}

// WorkspaceCreationResult is the WorkspaceCreationResult message type
type WorkspaceCreationResult struct {
	CreatedWorkspaceID string           `json:"createdWorkspaceId,omitempty"`
	ExistingWorkspaces []*WorkspaceInfo `json:"existingWorkspaces,omitempty"`
	WorkspaceURL       string           `json:"workspaceURL,omitempty"`
}

// Workspace is the Workspace message type
type Workspace struct {

	// The resolved/built fixed named of the base image. This field is only set if the workspace
	// already has its base image built.
	BaseImageNameResolved string           `json:"baseImageNameResolved,omitempty"`
	BasedOnPrebuildID     string           `json:"basedOnPrebuildId,omitempty"`
	BasedOnSnapshotID     string           `json:"basedOnSnapshotId,omitempty"`
	Config                *WorkspaceConfig `json:"config,omitempty"`

	// Marks the time when the workspace content has been deleted.
	ContentDeletedTime string            `json:"contentDeletedTime,omitempty"`
	Context            *WorkspaceContext `json:"context,omitempty"`
	ContextURL         string            `json:"contextURL,omitempty"`
	CreationTime       string            `json:"creationTime,omitempty"`
	Deleted            bool              `json:"deleted,omitempty"`
	Description        string            `json:"description,omitempty"`
	ID                 string            `json:"id,omitempty"`

	// The resolved, fix name of the workspace image. We only use this
	// to access the logs during an image build.
	ImageNameResolved string `json:"imageNameResolved,omitempty"`

	// The source where to get the workspace base image from. This source is resolved
	// during workspace creation. Once a base image has been built the information in here
	// is superseded by baseImageNameResolved.
	ImageSource    interface{} `json:"imageSource,omitempty"`
	OrganizationId string      `json:"organizationId,omitempty"`
	OwnerID        string      `json:"ownerId,omitempty"`
	Pinned         bool        `json:"pinned,omitempty"`
	Shareable      bool        `json:"shareable,omitempty"`

	// Mark as deleted (user-facing). The actual deletion of the workspace content is executed
	// with a (configurable) delay
	SoftDeleted string `json:"softDeleted,omitempty"`

	// Marks the time when the workspace was marked as softDeleted. The actual deletion of the
	// workspace content happens after a configurable period

	// SoftDeletedTime string `json:"softDeletedTime,omitempty"`           string is the            string message type
	Type string `json:"type,omitempty"`
}

// WorkspaceConfig is the WorkspaceConfig message type
type WorkspaceConfig struct {
	CheckoutLocation string `json:"checkoutLocation,omitempty"`

	// Set of automatically inferred feature flags. That's not something the user can set, but
	// that is set by gitpod at workspace creation time.
	FeatureFlags []string          `json:"_featureFlags,omitempty"`
	GitConfig    map[string]string `json:"gitConfig,omitempty"`
	Github       *GithubAppConfig  `json:"github,omitempty"`
	Ide          string            `json:"ide,omitempty"`
	Image        interface{}       `json:"image,omitempty"`

	// Where the config object originates from.
	//
	// repo - from the repository
	// derived - computed based on analyzing the repository
	// default - our static catch-all default config
	Origin            string        `json:"_origin,omitempty"`
	Ports             []*PortConfig `json:"ports,omitempty"`
	Privileged        bool          `json:"privileged,omitempty"`
	Tasks             []*TaskConfig `json:"tasks,omitempty"`
	Vscode            *VSCodeConfig `json:"vscode,omitempty"`
	WorkspaceLocation string        `json:"workspaceLocation,omitempty"`
}

// WorkspaceContext is the WorkspaceContext message type
type WorkspaceContext struct {
	ForceCreateNewWorkspace bool   `json:"forceCreateNewWorkspace,omitempty"`
	NormalizedContextURL    string `json:"normalizedContextURL,omitempty"`
	Title                   string `json:"title,omitempty"`

	// Commit context
	Repository *Repository `json:"repository,omitempty"`
	Revision   string      `json:"revision,omitempty"`
}

// WorkspaceImageSourceDocker is the WorkspaceImageSourceDocker message type
type WorkspaceImageSourceDocker struct {
	DockerFileHash   string  `json:"dockerFileHash,omitempty"`
	DockerFilePath   string  `json:"dockerFilePath,omitempty"`
	DockerFileSource *Commit `json:"dockerFileSource,omitempty"`
}

// WorkspaceImageSourceReference is the WorkspaceImageSourceReference message type
type WorkspaceImageSourceReference struct {

	// The resolved, fix base image reference
	BaseImageResolved string `json:"baseImageResolved,omitempty"`
}

// WorkspaceInfo is the WorkspaceInfo message type
type WorkspaceInfo struct {
	LatestInstance *WorkspaceInstance `json:"latestInstance,omitempty"`
	Workspace      *Workspace         `json:"workspace,omitempty"`
}

// WorkspaceInstance is the WorkspaceInstance message type
type WorkspaceInstance struct {
	Configuration  *WorkspaceInstanceConfiguration `json:"configuration,omitempty"`
	CreationTime   string                          `json:"creationTime,omitempty"`
	Deleted        bool                            `json:"deleted,omitempty"`
	DeployedTime   string                          `json:"deployedTime,omitempty"`
	ID             string                          `json:"id,omitempty"`
	IdeURL         string                          `json:"ideUrl,omitempty"`
	Region         string                          `json:"region,omitempty"`
	StartedTime    string                          `json:"startedTime,omitempty"`
	Status         *WorkspaceInstanceStatus        `json:"status,omitempty"`
	GitStatus      *WorkspaceInstanceRepoStatus    `json:"gitStatus,omitempty"`
	StoppedTime    string                          `json:"stoppedTime,omitempty"`
	WorkspaceID    string                          `json:"workspaceId,omitempty"`
	WorkspaceImage string                          `json:"workspaceImage,omitempty"`
}

// WorkspaceInstanceConditions is the WorkspaceInstanceConditions message type
type WorkspaceInstanceConditions struct {
	Deployed          bool   `json:"deployed,omitempty"`
	Failed            string `json:"failed,omitempty"`
	FirstUserActivity string `json:"firstUserActivity,omitempty"`
	NeededImageBuild  bool   `json:"neededImageBuild,omitempty"`
	PullingImages     bool   `json:"pullingImages,omitempty"`
	Timeout           string `json:"timeout,omitempty"`
}

// WorkspaceInstanceConfiguration is the WorkspaceInstanceConfiguration message type
type WorkspaceInstanceConfiguration struct {
	FeatureFlags []string `json:"featureFlags,omitempty"`
	TheiaVersion string   `json:"theiaVersion,omitempty"`
}

// WorkspaceInstanceRepoStatus is the WorkspaceInstanceRepoStatus message type
type WorkspaceInstanceRepoStatus struct {
	Branch               string   `json:"branch,omitempty"`
	LatestCommit         string   `json:"latestCommit,omitempty"`
	TotalUncommitedFiles float64  `json:"totalUncommitedFiles,omitempty"`
	TotalUnpushedCommits float64  `json:"totalUnpushedCommits,omitempty"`
	TotalUntrackedFiles  float64  `json:"totalUntrackedFiles,omitempty"`
	UncommitedFiles      []string `json:"uncommitedFiles,omitempty"`
	UnpushedCommits      []string `json:"unpushedCommits,omitempty"`
	UntrackedFiles       []string `json:"untrackedFiles,omitempty"`
}

// WorkspaceInstanceStatus is the WorkspaceInstanceStatus message type
type WorkspaceInstanceStatus struct {
	Conditions   *WorkspaceInstanceConditions `json:"conditions,omitempty"`
	ExposedPorts []*WorkspaceInstancePort     `json:"exposedPorts,omitempty"`
	Message      string                       `json:"message,omitempty"`
	NodeName     string                       `json:"nodeName,omitempty"`
	OwnerToken   string                       `json:"ownerToken,omitempty"`
	Phase        string                       `json:"phase,omitempty"`
	Timeout      string                       `json:"timeout,omitempty"`
	Version      int                          `json:"version,omitempty"`
}

// StartWorkspaceOptions is the StartWorkspaceOptions message type
type StartWorkspaceOptions struct {
	ForceDefaultImage bool         `json:"forceDefaultImage,omitempty"`
	WorkspaceClass    string       `json:"workspaceClass,omitempty"`
	IdeSettings       *IDESettings `json:"ideSettings,omitempty"`
	Region            string       `json:"region,omitempty"`
}

// GetWorkspaceTimeoutResult is the GetWorkspaceTimeoutResult message type
type GetWorkspaceTimeoutResult struct {
	CanChange             bool   `json:"canChange,omitempty"`
	Duration              string `json:"duration,omitempty"`
	HumanReadableDuration string `json:"humanReadableDuration,omitempty"`
}

// WorkspaceInstancePort is the WorkspaceInstancePort message type
type WorkspaceInstancePort struct {
	Port       float64 `json:"port,omitempty"`
	URL        string  `json:"url,omitempty"`
	Visibility string  `json:"visibility,omitempty"`
	Protocol   string  `json:"protocol,omitempty"`
}

const (
	PortVisibilityPublic  = "public"
	PortVisibilityPrivate = "private"
)

const (
	PortProtocolHTTP  = "http"
	PortProtocolHTTPS = "https"
)

// GithubAppConfig is the GithubAppConfig message type
type GithubAppConfig struct {
	Prebuilds *GithubAppPrebuildConfig `json:"prebuilds,omitempty"`
}

// GithubAppPrebuildConfig is the GithubAppPrebuildConfig message type
type GithubAppPrebuildConfig struct {
	AddBadge              bool        `json:"addBadge,omitempty"`
	AddCheck              interface{} `json:"addCheck,omitempty"`
	AddComment            bool        `json:"addComment,omitempty"`
	AddLabel              interface{} `json:"addLabel,omitempty"`
	Branches              bool        `json:"branches,omitempty"`
	Master                bool        `json:"master,omitempty"`
	PullRequests          bool        `json:"pullRequests,omitempty"`
	PullRequestsFromForks bool        `json:"pullRequestsFromForks,omitempty"`
}

// ImageConfigFile is the ImageConfigFile message type
type ImageConfigFile struct {
	Context string `json:"context,omitempty"`
	File    string `json:"file,omitempty"`
}

// PortConfig is the PortConfig message type
type PortConfig struct {
	OnOpen      string  `json:"onOpen,omitempty"`
	Port        float64 `json:"port,omitempty"`
	Visibility  string  `json:"visibility,omitempty"`
	Description string  `json:"description,omitempty"`
	Name        string  `json:"name,omitempty"`
	Protocol    string  `json:"protocol,omitempty"`
}

// TaskConfig is the TaskConfig message type
type TaskConfig struct {
	Before   string                 `json:"before,omitempty"`
	Command  string                 `json:"command,omitempty"`
	Env      map[string]interface{} `json:"env,omitempty"`
	Init     string                 `json:"init,omitempty"`
	Name     string                 `json:"name,omitempty"`
	OpenIn   string                 `json:"openIn,omitempty"`
	OpenMode string                 `json:"openMode,omitempty"`
	Prebuild string                 `json:"prebuild,omitempty"`
}

// VSCodeConfig is the VSCodeConfig message type
type VSCodeConfig struct {
	Extensions []string `json:"extensions,omitempty"`
}

// Configuration is the Configuration message type
type Configuration struct {
	DaysBeforeGarbageCollection float64 `json:"daysBeforeGarbageCollection,omitempty"`
	GarbageCollectionStartDate  float64 `json:"garbageCollectionStartDate,omitempty"`
}

// EnvVar is the EnvVar message type
type EnvVar struct {
	ID    string `json:"id,omitempty"`
	Name  string `json:"name,omitempty"`
	Value string `json:"value,omitempty"`
}

// UserEnvVarValue is the UserEnvVarValue message type
type UserEnvVarValue struct {
	ID                string `json:"id,omitempty"`
	Name              string `json:"name,omitempty"`
	RepositoryPattern string `json:"repositoryPattern,omitempty"`
	Value             string `json:"value,omitempty"`
}

type SSHPublicKeyValue struct {
	Name string `json:"name,omitempty"`
	Key  string `json:"key,omitempty"`
}

type UserSSHPublicKeyValue struct {
	ID           string `json:"id,omitempty"`
	Name         string `json:"name,omitempty"`
	Key          string `json:"key,omitempty"`
	Fingerprint  string `json:"fingerprint,omitempty"`
	CreationTime string `json:"creationTime,omitempty"`
	LastUsedTime string `json:"lastUsedTime,omitempty"`
}

// GenerateNewGitpodTokenOptions is the GenerateNewGitpodTokenOptions message type
type GenerateNewGitpodTokenOptions struct {
	Name string `json:"name,omitempty"`

	// Scopes []string `json:"scopes,omitempty"`  float64 is the   float64 message type
	Type float64 `json:"type,omitempty"`
}

// TakeSnapshotOptions is the TakeSnapshotOptions message type
type TakeSnapshotOptions struct {
	WorkspaceID string `json:"workspaceId,omitempty"`
	DontWait    bool   `json:"dontWait,omitempty"`
}

// AdminBlockUserRequest is the AdminBlockUserRequest message type
type AdminBlockUserRequest struct {
	UserID    string `json:"id,omitempty"`
	IsBlocked bool   `json:"blocked,omitempty"`
}

// PickAuthProviderEntryHostOwnerIDType is the PickAuthProviderEntryHostOwnerIDType message type
type PickAuthProviderEntryHostOwnerIDType struct {
	Host string `json:"host,omitempty"`

	// OwnerId string `json:"ownerId,omitempty"`   string is the    string message type
	Type string `json:"type,omitempty"`
}

// PickAuthProviderEntryOwnerID is the PickAuthProviderEntryOwnerID message type
type PickAuthProviderEntryOwnerID struct {
	ID      string `json:"id,omitempty"`
	OwnerID string `json:"ownerId,omitempty"`
}

// PickOAuth2ConfigClientIDClientSecret is the PickOAuth2ConfigClientIDClientSecret message type
type PickOAuth2ConfigClientIDClientSecret struct {
	ClientID     string `json:"clientId,omitempty"`
	ClientSecret string `json:"clientSecret,omitempty"`
}

// UpdateOwnAuthProviderParams is the UpdateOwnAuthProviderParams message type
type UpdateOwnAuthProviderParams struct {
	Entry interface{} `json:"entry,omitempty"`
}

// CreateWorkspaceOptions is the CreateWorkspaceOptions message type
type CreateWorkspaceOptions struct {
	StartWorkspaceOptions
	ContextURL                         string `json:"contextUrl,omitempty"`
	ProjectId                          string `json:"projectId,omitempty"`
	OrganizationId                     string `json:"organizationId,omitempty"`
	IgnoreRunningWorkspaceOnSameCommit bool   `json:"ignoreRunningWorkspaceOnSameCommit,omitempty"`
	ForceDefaultConfig                 bool   `json:"forceDefaultConfig,omitempty"`
	IgnoreRunningPrebuild              bool   `json:"ignoreRunningPrebuild,omitempty"`
	AllowUsingPreviousPrebuilds        bool   `json:"allowUsingPreviousPrebuilds,omitempty"`
}

// DeleteOwnAuthProviderParams is the DeleteOwnAuthProviderParams message type
type DeleteOwnAuthProviderParams struct {
	ID string `json:"id,omitempty"`
}

// GuessGitTokenScopesParams is the GuessGitTokenScopesParams message type
type GuessGitTokenScopesParams struct {
	Host         string    `json:"host"`
	RepoURL      string    `json:"repoUrl"`
	GitCommand   string    `json:"gitCommand"`
	CurrentToken *GitToken `json:"currentToken"`
}

type GitToken struct {
	Token  string   `json:"token"`
	User   string   `json:"user"`
	Scopes []string `json:"scopes"`
}

// GuessedGitTokenScopes is the GuessedGitTokenScopes message type
type GuessedGitTokenScopes struct {
	Scopes  []string `json:"scopes,omitempty"`
	Message string   `json:"message,omitempty"`
}

// SupportedWorkspaceClass is the GetSupportedWorkspaceClasses message type
type SupportedWorkspaceClass struct {
	ID          string `json:"id,omitempty"`
	Category    string `json:"category,omitempty"`
	DisplayName string `json:"displayName,omitempty"`
	Description string `json:"description,omitempty"`
	Powerups    int    `json:"powerups,omitempty"`
	IsDefault   bool   `json:"isDefault,omitempty"`
}

type RemoteTrackMessage struct {
	Event      string      `json:"event,omitempty"`
	Properties interface{} `json:"properties,omitempty"`
}

// WorkspaceInstanceUser is the WorkspaceInstanceUser message type
type WorkspaceInstanceUser struct {
	AvatarURL  string `json:"avatarUrl,omitempty"`
	InstanceID string `json:"instanceId,omitempty"`
	LastSeen   string `json:"lastSeen,omitempty"`
	Name       string `json:"name,omitempty"`
	UserID     string `json:"userId,omitempty"`
}

// SendHeartBeatOptions is the SendHeartBeatOptions message type
type SendHeartBeatOptions struct {
	InstanceID    string  `json:"instanceId,omitempty"`
	RoundTripTime float64 `json:"roundTripTime,omitempty"`
	WasClosed     bool    `json:"wasClosed,omitempty"`
}

// AdditionalUserData is the AdditionalUserData message type
type AdditionalUserData struct {
	EmailNotificationSettings *EmailNotificationSettings `json:"emailNotificationSettings,omitempty"`
	Platforms                 []*UserPlatform            `json:"platforms,omitempty"`
	IdeSettings               *IDESettings               `json:"ideSettings,omitempty"`
}

// IDESettings is the IDESettings message type
type IDESettings struct {
	DefaultIde        string `json:"defaultIde,omitempty"`
	UseDesktopIde     bool   `json:"useDesktopIde,omitempty"`
	DefaultDesktopIde string `json:"defaultDesktopIde,omitempty"`
	UseLatestVersion  bool   `json:"useLatestVersion"`
}

// EmailNotificationSettings is the EmailNotificationSettings message type
type EmailNotificationSettings struct {
	DisallowTransactionalEmails bool `json:"disallowTransactionalEmails,omitempty"`
}

// Identity is the Identity message type
type Identity struct {
	AuthID         string `json:"authId,omitempty"`
	AuthName       string `json:"authName,omitempty"`
	AuthProviderID string `json:"authProviderId,omitempty"`

	// This is a flag that triggers the HARD DELETION of this entity
	Deleted      bool     `json:"deleted,omitempty"`
	PrimaryEmail string   `json:"primaryEmail,omitempty"`
	Readonly     bool     `json:"readonly,omitempty"`
	Tokens       []*Token `json:"tokens,omitempty"`
}

// User is the User message type
type User struct {
	AdditionalData               *AdditionalUserData `json:"additionalData,omitempty"`
	AllowsMarketingCommunication bool                `json:"allowsMarketingCommunication,omitempty"`
	AvatarURL                    string              `json:"avatarUrl,omitempty"`

	// Whether the user has been blocked to use our service, because of TOS violation for example.
	// Optional for backwards compatibility.
	Blocked bool `json:"blocked,omitempty"`

	// The timestamp when the user entry was created
	CreationDate string `json:"creationDate,omitempty"`

	// A map of random settings that alter the behaviour of Gitpod on a per-user basis
	FeatureFlags *UserFeatureSettings `json:"featureFlags,omitempty"`

	// Optional for backwards compatibility
	FullName string `json:"fullName,omitempty"`

	// The user id
	ID         string      `json:"id,omitempty"`
	Identities []*Identity `json:"identities,omitempty"`

	// Whether the user is logical deleted. This flag is respected by all queries in UserDB
	MarkedDeleted bool   `json:"markedDeleted,omitempty"`
	Name          string `json:"name,omitempty"`

	// The ID of the Organization this user is owned by. If empty, the user is owned by the installation
	OrganizationId string `json:"organizationId,omitempty"`

	// whether this user can run workspaces in privileged mode
	Privileged bool `json:"privileged,omitempty"`

	// The permissions and/or roles the user has
	RolesOrPermissions []string `json:"rolesOrPermissions,omitempty"`
}

// Token is the Token message type
type Token struct {
	ExpiryDate   string   `json:"expiryDate,omitempty"`
	IDToken      string   `json:"idToken,omitempty"`
	RefreshToken string   `json:"refreshToken,omitempty"`
	Scopes       []string `json:"scopes,omitempty"`
	UpdateDate   string   `json:"updateDate,omitempty"`
	Username     string   `json:"username,omitempty"`
	Value        string   `json:"value,omitempty"`
}

// UserFeatureSettings is the UserFeatureSettings message type
type UserFeatureSettings struct {

	// Permanent feature flags are added to each and every workspace instance
	// this user starts.
	PermanentWSFeatureFlags []string `json:"permanentWSFeatureFlags,omitempty"`
}

// UserPlatform is the UserPlatform message type
type UserPlatform struct {
	Browser string `json:"browser,omitempty"`

	// Since when does the user have the browser extension installe don this device.
	BrowserExtensionInstalledSince string `json:"browserExtensionInstalledSince,omitempty"`

	// Since when does the user not have the browser extension installed anymore (but previously had).
	BrowserExtensionUninstalledSince string `json:"browserExtensionUninstalledSince,omitempty"`
	FirstUsed                        string `json:"firstUsed,omitempty"`
	LastUsed                         string `json:"lastUsed,omitempty"`
	Os                               string `json:"os,omitempty"`
	UID                              string `json:"uid,omitempty"`
	UserAgent                        string `json:"userAgent,omitempty"`
}

// Requirements is the Requirements message type
type Requirements struct {
	Default     []string `json:"default,omitempty"`
	PrivateRepo []string `json:"privateRepo,omitempty"`
	PublicRepo  []string `json:"publicRepo,omitempty"`
}

// AuthProviderInfo is the AuthProviderInfo message type
type AuthProviderInfo struct {
	AuthProviderID      string        `json:"authProviderId,omitempty"`
	AuthProviderType    string        `json:"authProviderType,omitempty"`
	Description         string        `json:"description,omitempty"`
	DisallowLogin       bool          `json:"disallowLogin,omitempty"`
	HiddenOnDashboard   bool          `json:"hiddenOnDashboard,omitempty"`
	Host                string        `json:"host,omitempty"`
	Icon                string        `json:"icon,omitempty"`
	IsReadonly          bool          `json:"isReadonly,omitempty"`
	LoginContextMatcher string        `json:"loginContextMatcher,omitempty"`
	OwnerID             string        `json:"ownerId,omitempty"`
	Requirements        *Requirements `json:"requirements,omitempty"`
	Scopes              []string      `json:"scopes,omitempty"`
	SettingsURL         string        `json:"settingsUrl,omitempty"`
	Verified            bool          `json:"verified,omitempty"`
}

// GetTokenSearchOptions is the GetTokenSearchOptions message type
type GetTokenSearchOptions struct {
	Host string `json:"host,omitempty"`
}

// SetWorkspaceTimeoutResult is the SetWorkspaceTimeoutResult message type
type SetWorkspaceTimeoutResult struct {
	ResetTimeoutOnWorkspaces []string `json:"resetTimeoutOnWorkspaces,omitempty"`
	HumanReadableDuration    string   `json:"humanReadableDuration,omitempty"`
}

// UserMessage is the UserMessage message type
type UserMessage struct {
	Content string `json:"content,omitempty"`

	// date from where on this message should be shown
	From  string `json:"from,omitempty"`
	ID    string `json:"id,omitempty"`
	Title string `json:"title,omitempty"`
	URL   string `json:"url,omitempty"`
}

type Team struct {
	ID           string `json:"id,omitempty"`
	Name         string `json:"name,omitempty"`
	Slug         string `json:"slug,omitempty"`
	CreationTime string `json:"creationTime,omitempty"`
}

type TeamMemberRole string

const (
	TeamMember_Owner  TeamMemberRole = "owner"
	TeamMember_Member TeamMemberRole = "member"
)

type TeamMemberInfo struct {
	UserId              string         `json:"userId,omitempty"`
	FullName            string         `json:"fullName,omitempty"`
	PrimaryEmail        string         `json:"primaryEmail,omitempty"`
	AvatarUrl           string         `json:"avatarUrl,omitempty"`
	Role                TeamMemberRole `json:"role,omitempty"`
	MemberSince         string         `json:"memberSince,omitempty"`
	OwnedByOrganization bool           `json:"ownedByOrganization,omitempty"`
}

type TeamMembershipInvite struct {
	ID               string         `json:"id,omitempty"`
	TeamID           string         `json:"teamId,omitempty"`
	Role             TeamMemberRole `json:"role,omitempty"`
	CreationTime     string         `json:"creationTime,omitempty"`
	InvalidationTime string         `json:"invalidationTime,omitempty"`
	InvitedEmail     string         `json:"invitedEmail,omitempty"`
}

type OrganizationSettings struct {
	WorkspaceSharingDisabled bool   `json:"workspaceSharingDisabled,omitempty"`
	DefaultWorkspaceImage    string `json:"defaultWorkspaceImage,omitempty"`
}

type Project struct {
	ID                string           `json:"id,omitempty"`
	UserID            string           `json:"userId,omitempty"`
	TeamID            string           `json:"teamId,omitempty"`
	Name              string           `json:"name,omitempty"`
	Slug              string           `json:"slug,omitempty"`
	CloneURL          string           `json:"cloneUrl,omitempty"`
	AppInstallationID string           `json:"appInstallationId,omitempty"`
	Settings          *ProjectSettings `json:"settings,omitempty"`
	CreationTime      string           `json:"creationTime,omitempty"`
}

type ProjectSettings struct {
	UsePersistentVolumeClaim   bool                      `json:"usePersistentVolumeClaim,omitempty"`
	WorkspaceClasses           *WorkspaceClassesSettings `json:"workspaceClasses,omitempty"`
	PrebuildSettings           *PrebuildSettings         `json:"prebuilds,omitempty"`
	RestrictedWorkspaceClasses *[]string                 `json:"restrictedWorkspaceClasses,omitempty"`
}
type PrebuildSettings struct {
	Enable                *bool   `json:"enable,omitempty"`
	PrebuildInterval      *int32  `json:"prebuildInterval,omitempty"`
	BranchStrategy        *string `json:"branchStrategy,omitempty"`
	BranchMatchingPattern *string `json:"branchMatchingPattern,omitempty"`
	WorkspaceClass        *string `json:"workspaceClass,omitempty"`
}

type WorkspaceClassesSettings struct {
	Regular  string `json:"regular,omitempty"`
	Prebuild string `json:"prebuild,omitempty"`
}

type CreateProjectOptions struct {
	UserID            string `json:"userId,omitempty"`
	TeamID            string `json:"teamId,omitempty"`
	Name              string `json:"name,omitempty"`
	Slug              string `json:"slug,omitempty"`
	CloneURL          string `json:"cloneUrl,omitempty"`
	AppInstallationID string `json:"appInstallationId,omitempty"`
}

type IDEType string

const (
	IDETypeBrowser IDEType = "browser"
	IDETypeDesktop IDEType = "desktop"
)

type IDEConfig struct {
	SupervisorImage string     `json:"supervisorImage"`
	IdeOptions      IDEOptions `json:"ideOptions"`
}

type IDEOptions struct {
	// Options is a list of available IDEs.
	Options map[string]IDEOption `json:"options"`
	// DefaultIde when the user has not specified one.
	DefaultIde string `json:"defaultIde"`
	// DefaultDesktopIde when the user has not specified one.
	DefaultDesktopIde string `json:"defaultDesktopIde"`
	// Clients specific IDE options.
	Clients map[string]IDEClient `json:"clients"`
}

type IDEOption struct {
	// OrderKey to ensure a stable order one can set an `orderKey`.
	OrderKey string `json:"orderKey,omitempty"`
	// Title with human readable text of the IDE (plain text only).
	Title string `json:"title"`
	// Type of the IDE, currently 'browser' or 'desktop'.
	Type IDEType `json:"type"`
	// Logo URL for the IDE. See also components/ide-proxy/static/image/ide-log/ folder
	Logo string `json:"logo"`
	// Tooltip plain text only
	Tooltip string `json:"tooltip,omitempty"`
	// Label is next to the IDE option like “Browser” (plain text only).
	Label string `json:"label,omitempty"`
	// Notes to the IDE option that are rendered in the preferences when a user chooses this IDE.
	Notes []string `json:"notes,omitempty"`
	// Hidden this IDE option is not visible in the IDE preferences.
	Hidden bool `json:"hidden,omitempty"`
	// Experimental this IDE option is to only be shown to some users
	Experimental bool `json:"experimental,omitempty"`
	// Image ref to the IDE image.
	Image string `json:"image"`
	// LatestImage ref to the IDE image, this image ref always resolve to digest.
	LatestImage string `json:"latestImage,omitempty"`
	// ResolveImageDigest when this is `true`, the tag of this image is resolved to the latest image digest regularly.
	// This is useful if this image points to a tag like `nightly` that will be updated regularly. When `resolveImageDigest` is `true`, we make sure that we resolve the tag regularly to the most recent image version.
	ResolveImageDigest bool `json:"resolveImageDigest,omitempty"`
	// PluginImage ref for the IDE image, this image ref always resolve to digest.
	// DEPRECATED use ImageLayers instead
	PluginImage string `json:"pluginImage,omitempty"`
	// PluginLatestImage ref for the latest IDE image, this image ref always resolve to digest.
	// DEPRECATED use LatestImageLayers instead
	PluginLatestImage string `json:"pluginLatestImage,omitempty"`
	// ImageVersion the semantic version of the IDE image.
	ImageVersion string `json:"imageVersion,omitempty"`
	// LatestImageVersion the semantic version of the latest IDE image.
	LatestImageVersion string `json:"latestImageVersion,omitempty"`
	// ImageLayers for additional ide layers and dependencies
	ImageLayers []string `json:"imageLayers,omitempty"`
	// LatestImageLayers for latest additional ide layers and dependencies
	LatestImageLayers []string `json:"latestImageLayers,omitempty"`
}

type IDEClient struct {
	// DefaultDesktopIDE when the user has not specified one.
	DefaultDesktopIDE string `json:"defaultDesktopIDE,omitempty"`
	// DesktopIDEs supported by the client.
	DesktopIDEs []string `json:"desktopIDEs,omitempty"`
	// InstallationSteps to install the client on user machine.
	InstallationSteps []string `json:"installationSteps,omitempty"`
}

type GetDefaultWorkspaceImageParams struct {
	WorkspaceID string `json:"workspaceId,omitempty"`
}

type WorkspaceImageSource string

const (
	WorkspaceImageSourceInstallation WorkspaceImageSource = "installation"
	WorkspaceImageSourceOrganization WorkspaceImageSource = "organization"
)

type GetDefaultWorkspaceImageResult struct {
	Image  string               `json:"image,omitempty"`
	Source WorkspaceImageSource `json:"source,omitempty"`
}
