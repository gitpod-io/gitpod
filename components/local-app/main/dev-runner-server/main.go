// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/Masterminds/sprig/v3"
	"github.com/bufbuild/connect-go"
	gitpod_experimental_v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	gitpod_experimental_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	gitpod_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/v1/v1connect"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	hdlr := &handler{
		cond:       sync.NewCond(&sync.Mutex{}),
		Workspaces: make(map[string]*v1.RunnerWorkspace),
		Status:     make(map[string]*v1.WorkspaceStatus),
		Runner:     make(map[string]*Runner),
	}

	mux := http.NewServeMux()
	mux.Handle("/api/create/", http.StripPrefix("/api/create/", http.HandlerFunc(hdlr.StartWorkspaceFromContext)))
	mux.Handle("/api/stop/", http.StripPrefix("/api/stop/", http.HandlerFunc(hdlr.StopWorkspace)))
	mux.Handle("/api/list", http.StripPrefix("/api/list", http.HandlerFunc(hdlr.ListWorkspces)))

	mux.Handle(gitpod_v1connect.NewWorkspaceRunnerServiceHandler(hdlr))
	mux.Handle(gitpod_experimental_v1connect.NewUserServiceHandler(&userHandler{}))
	mux.HandleFunc("/analytics/v1/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		slog.Info("not found", "path", r.URL.Path)
		http.Error(w, "not found", http.StatusNotFound)
	})
	panic(http.ListenAndServe(
		"localhost:8080",
		// Use h2c so we can serve HTTP/2 without TLS.
		h2c.NewHandler(mux, &http2.Server{}),
	))
}

type Runner struct {
	Details  *v1.RegisterRunnerRequest
	LastSeen time.Time
}

type handler struct {
	gitpod_v1connect.UnimplementedWorkspaceRunnerServiceHandler

	Workspaces map[string]*v1.RunnerWorkspace
	Status     map[string]*v1.WorkspaceStatus
	Runner     map[string]*Runner
	cond       *sync.Cond
}

func (h *handler) StartWorkspaceFromContext(rw http.ResponseWriter, req *http.Request) {
	slog.Info("start workspace from context", "path", req.URL.Path)

	init, err := parseContext(req.URL.Path)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
	}

	id := generateRandomWorkspaceID()
	h.cond.L.Lock()
	h.Workspaces[id] = &v1.RunnerWorkspace{
		Id:           id,
		DesiredPhase: v1.WorkspacePhase_PHASE_RUNNING,
		Metadata: &v1.WorkspaceMetadata{
			OwnerId:            "test",
			OriginalContextUrl: req.URL.Path,
		},
		Spec: &v1.WorkspaceSpec{
			Initializer: init,
			Type:        v1.WorkspaceSpec_WORKSPACE_TYPE_REGULAR,
			Git: &v1.WorkspaceSpec_GitSpec{
				Username: "Demo User",
				Email:    "demo@gitpod.io",
			},
			Class:     "default",
			Admission: v1.AdmissionLevel_ADMISSION_LEVEL_EVERYONE,
		},
	}
	h.cond.Broadcast()
	defer h.cond.L.Unlock()

	http.Redirect(rw, req, "/api/list", http.StatusFound)
}

func (h *handler) StopWorkspace(rw http.ResponseWriter, req *http.Request) {
	h.cond.L.Lock()
	defer h.cond.L.Unlock()

	slog.Info("stop workspace", "path", req.URL.Path)
	var found bool

	for i, ws := range h.Workspaces {
		if ws.Id == req.URL.Path {
			found = true
			break
		}
		h.Workspaces[i].DesiredPhase = v1.WorkspacePhase_PHASE_STOPPED
	}
	if !found {
		http.Error(rw, "not found", http.StatusNotFound)
		return
	}

	rw.WriteHeader(http.StatusOK)
}

var listTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Workspace Manager</title>
<style>
    body {
        font-family: Arial, sans-serif;
        background-color: #333;
        color: white;
        margin: 0;
        padding: 20px;
    }
    .container {
        width: 80%;
        margin: auto;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .header h1 {
        margin: 0;
    }
    .create-input {
        padding: 10px;
        border: none;
        border-radius: 4px;
        margin-right: 10px;
    }
    .create-button {
        padding: 10px 20px;
        background-color: #555;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
    }
    .create-button:hover {
        background-color: #666;
    }
    .workspace-list {
        list-style-type: none;
        padding: 0;
    }
    .workspace-item {
        background-color: #222;
        padding: 20px;
        border-radius: 4px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .workspace-status {
        margin: 0;
    }
    .stop-button {
        padding: 10px 20px;
        background-color: #d9534f;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
    }
    .stop-button:hover {
        background-color: #c9302c;
    }

	a {
		color: white;
	}
</style>
<script>
setTimeout(function() {
	window.location.reload();
}, 5000);
</script>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>Workspaces</h1>
        <div>
            <button class="create-button" onclick="location.href=location.href.substring(0, location.href.lastIndexOf('/'))+'/create/'+prompt('Context URL')">Create</button>
        </div>
    </div>
    <ul class="workspace-list">
        <!-- Workspace items will be added here -->
		{{ range .Workspaces }}
        <li class="workspace-item">
            <div>
			{{ if .Status }}
				<a href="{{ .Status.WorkspaceUrl }}"><h2 class="workspace-name">{{ if (eq (.Status.Phase.Name | toString) "PHASE_RUNNING") }}🟢{{ else }}🟡{{ end }} {{ .Workspace.Id }}</h2></a>
                <p class="workspace-status">URL: {{ .Status.WorkspaceUrl }}</p>
                <p class="workspace-status">Actual Phase: {{ .Status.Phase.Name }}</p>
                <p class="workspace-status">Status: <pre>{{ .Status | toPrettyJson }}</pre></p>
				{{ else }}
				<h2 class="workspace-name">🔘 {{ .Workspace.Id }}</h2>
				{{ end }}
                <p class="workspace-status">Context URL: <a href="{{ .Workspace.Metadata.OriginalContextUrl }}" target="_blank">{{ .Workspace.Metadata.OriginalContextUrl }}</a></p>
            </div>
            <button class="stop-button" onclick="window.open(location.href.substring(0, location.href.lastIndexOf('/'))+'/stop/{{ .Workspace.Id }}')">Stop Workspace</button>
        </li>
		{{ end }}
    </ul>

	<div class="header">
		<h1>Runner</h1>
	</div>
	{{ range .Runner }}
	<li class="workspace-item">
		<div>
			<h2 class="workspace-name">{{ if .Online }}🟢{{ else }}🔴{{ end }} {{ .Details.Name }}</h2>
			<p class="workspace-status">Last Seen: <code>{{ .LastSeen }}</code></p>
		</div>
	</li>
	{{ end }}
</div>
</body>
</html>
`

func (h *handler) ListWorkspces(rw http.ResponseWriter, req *http.Request) {
	h.cond.L.Lock()
	defer h.cond.L.Unlock()

	tpl, err := template.New("list").Funcs(sprig.FuncMap()).Parse(listTemplate)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	type Runner struct {
		Details  *v1.RegisterRunnerRequest
		LastSeen time.Duration
		Online   bool
	}
	var runner []Runner
	for _, r := range h.Runner {
		runner = append(runner, Runner{
			Details:  r.Details,
			LastSeen: time.Since(r.LastSeen),
			Online:   time.Since(r.LastSeen) < 20*time.Second,
		})
	}

	type WorkspaceAndStatus struct {
		Workspace *v1.RunnerWorkspace
		Status    *v1.WorkspaceStatus
	}
	err = tpl.Execute(rw, struct {
		Workspaces []WorkspaceAndStatus
		Runner     []Runner
	}{
		Workspaces: func() []WorkspaceAndStatus {
			var workspaces []WorkspaceAndStatus
			for _, ws := range h.Workspaces {
				workspaces = append(workspaces, WorkspaceAndStatus{
					Workspace: ws,
					Status:    h.Status[ws.Id],
				})
			}
			return workspaces
		}(),
		Runner: runner,
	})
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
}

var (
	adjectives = []string{
		"Wacky", "Silly", "Jolly", "Quirky", "Zany", "Amusing", "Bouncy", "Cheery", "Daring", "Energetic",
		"Funky", "Gleeful", "Happy", "Inventive", "Jaunty", "Kooky", "Lively", "Merry", "Nifty", "Optimistic",
		"Playful", "Quaint", "Rascally", "Spirited", "Twinkly", "Upbeat", "Vivacious", "Whimsical", "Xenial", "Youthful",
		"Zesty", "Animated", "Blissful", "Charming", "Delightful", "Elated", "Frisky", "Grinning", "Hilarious", "Impish",
		"Joyous", "Kindly", "Laughing", "Mischievous", "Naughty", "Outgoing", "Pleased", "Radiant", "Sunny", "Tickled",
		"Unique", "Vibrant", "Wonderful", "Xtra", "Yummy", "Zealous", "Affable", "Breezy", "Chilled", "Dapper",
		"Effervescent", "Frolicsome", "Giddy", "Hearty", "Irresistible", "Jubilant", "Keen", "Lighthearted", "Mirthful", "Nimble",
		"Obliging", "Punchy", "Quirky", "Ravishing", "Snazzy", "Thrilled", "Uplifted", "Vivid", "Whopping", "Xenodochial",
		"Yielding", "Zippy", "Amiable", "Bubbly", "Chipper", "Dazzling", "Ebullient", "Frivolous", "Giggly", "Heavenly", "Inviting", "Jocular",
		"Klutzy", "Luminous", "Magical", "Natty", "Overjoyed", "Perky", "Quizzical", "Ritzy", "Saucy", "Twirly",
		"Unstoppable", "Voluptuous", "Witty", "Xanadu", "Yapping", "Zazzy",
	}
	animals = []string{
		"Kangaroo", "Penguin", "Llama", "Unicorn", "Platypus", "Aardvark", "Badger", "Cheetah", "Dolphin", "Elephant",
		"Flamingo", "Giraffe", "Hippo", "Iguana", "Jaguar", "Koala", "Lemur", "Meerkat", "Narwhal", "Ostrich",
		"Panda", "Quokka", "Raccoon", "Sloth", "Tiger", "Uakari", "Vulture", "Walrus", "Xerus", "Yak",
		"Zebra", "Alpaca", "Beaver", "Camel", "Dingo", "Emu", "Ferret", "Gorilla", "Hyena", "Impala",
		"Jackal", "Kiwi", "Lynx", "Mongoose", "Newt", "Octopus", "Pangolin", "Quail", "Rabbit", "Seal",
		"Turtle", "Urchin", "Viper", "Wombat", "Xenopus", "Yak", "Zebu", "Armadillo", "Buffalo", "Coyote",
		"Donkey", "Eel", "Fox", "Gazelle", "Hamster", "Ibex", "Jerboa", "Kinkajou", "Leopard", "Marmoset",
		"Numbat", "Ocelot", "Parrot", "Quetzal", "Reindeer", "Skunk", "Tapir", "Urial", "Vicuna", "Wallaby",
		"Xiphosuran", "Yellowjacket", "Zorilla", "Axolotl", "Bison", "Capybara", "Dugong", "Ermine", "Falcon",
		"Gecko", "Heron", "Indri", "Jackrabbit", "Kudu", "Loris", "Mandrill", "Narwhal", "Okapi", "Peacock",
		"Quahog", "Rattlesnake", "Starfish", "Tamarin",
	}
)

func generateRandomWorkspaceID() string {
	return strings.ToLower(adjectives[rand.Intn(len(adjectives))] + "-" + animals[rand.Intn(len(animals))])
}

func parseContext(contextURL string) (*v1.WorkspaceInitializer, error) {
	// Validate the URL (basic validation, can be extended as needed)
	if !strings.HasPrefix(contextURL, "github.com/") && !strings.HasPrefix(contextURL, "https://github.com/") && !strings.HasPrefix(contextURL, "git@github.com:") {
		return nil, fmt.Errorf("context URL is not a valid GitHub URL")
	}

	url := strings.Replace(contextURL, "https://github.com/", "", 1)
	url = strings.Replace(url, "git@github.com:", "", 1)
	url = strings.TrimSuffix(url, ".git")
	parts := strings.Split(url, "/")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid GitHub URL format")
	}

	var (
		owner = parts[1]
		repo  = parts[2]

		remoteURI        = fmt.Sprintf("https://github.com/%s/%s.git", owner, repo)
		checkoutLocation = repo
	)

	// Checking for additional parts in the URL (branch or commit)
	var ref string
	if len(parts) > 2 {
		// The ref (branch or commit) is expected to be after 'tree' or 'blob' in the URL
		for i, part := range parts {
			if part == "tree" || part == "blob" {
				if i+1 < len(parts) {
					ref = parts[i+1]
					break
				}
			}
		}
	}
	if ref == "" {
		ref = "main"
	}

	return &v1.WorkspaceInitializer{
		Specs: []*v1.WorkspaceInitializer_Spec{
			{
				Spec: &v1.WorkspaceInitializer_Spec_Git{
					Git: &v1.GitInitializer{
						RemoteUri:        remoteURI,
						TargetMode:       v1.GitInitializer_CLONE_TARGET_MODE_REMOTE_BRANCH,
						CloneTaget:       ref,
						CheckoutLocation: checkoutLocation,
						Config: &v1.GitInitializer_GitConfig{
							Authentication: v1.GitInitializer_AUTH_METHOD_UNSPECIFIED,
						},
					},
				},
			},
		},
	}, nil
}

func (h *handler) RegisterRunner(ctx context.Context, req *connect.Request[v1.RegisterRunnerRequest]) (*connect.Response[v1.RegisterRunnerResponse], error) {
	runnerID := req.Msg.Name
	slog.Info("register runner", "scope", req.Msg.Scope, "runnerID", runnerID)
	h.cond.L.Lock()
	defer h.cond.L.Unlock()
	h.Runner[runnerID] = &Runner{
		Details:  req.Msg,
		LastSeen: time.Now(),
	}

	return &connect.Response[v1.RegisterRunnerResponse]{
		Msg: &v1.RegisterRunnerResponse{
			ClusterId: runnerID,
		},
	}, nil
}

func (h *handler) RenewRunnerRegistration(ctx context.Context, req *connect.Request[v1.RenewRunnerRegistrationRequest]) (*connect.Response[v1.RenewRunnerRegistrationResponse], error) {
	slog.Info("renew runner registration", "runnerID", req.Msg.ClusterId)
	h.cond.L.Lock()
	defer h.cond.L.Unlock()

	runner, ok := h.Runner[req.Msg.ClusterId]
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("runner not found"))
	}
	runner.LastSeen = time.Now()

	return &connect.Response[v1.RenewRunnerRegistrationResponse]{
		Msg: &v1.RenewRunnerRegistrationResponse{},
	}, nil
}

func (h *handler) ListRunnerWorkspaces(ctx context.Context, req *connect.Request[v1.ListRunnerWorkspacesRequest]) (*connect.Response[v1.ListRunnerWorkspacesResponse], error) {
	wss := make([]*v1.RunnerWorkspace, 0, len(h.Workspaces))
	for _, ws := range h.Workspaces {
		wss = append(wss, ws)
	}

	return &connect.Response[v1.ListRunnerWorkspacesResponse]{
		Msg: &v1.ListRunnerWorkspacesResponse{
			Pagination: &v1.PaginationResponse{Total: int32(len(h.Workspaces))},
			Workspaces: wss,
		},
	}, nil
}

func (h *handler) WatchRunnerWorkspaces(ctx context.Context, req *connect.Request[v1.WatchRunnerWorkspacesRequest], srv *connect.ServerStream[v1.WatchRunnerWorkspacesResponse]) error {
	for {
		h.cond.L.Lock()
		h.cond.Wait()
		for _, ws := range h.Workspaces {
			err := srv.Send(&v1.WatchRunnerWorkspacesResponse{
				ClusterId: "runner-id-goes-here",
				Workspace: ws,
			})
			if err != nil {
				return err
			}
		}
		h.cond.L.Unlock()
	}
}

func (h *handler) UpdateRunnerWorkspaceStatus(ctx context.Context, req *connect.Request[v1.UpdateRunnerWorkspaceStatusRequest]) (*connect.Response[v1.UpdateRunnerWorkspaceStatusResponse], error) {
	slog.Info("update runner workspace status", "workspaceID", req.Msg.WorkspaceId, "status", req.Msg.Update)

	h.cond.L.Lock()
	defer h.cond.L.Unlock()

	if _, ok := h.Workspaces[req.Msg.WorkspaceId]; !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("workspace not found"))
	}

	switch update := req.Msg.Update.(type) {
	case *v1.UpdateRunnerWorkspaceStatusRequest_Status:
		h.Status[req.Msg.WorkspaceId] = update.Status
	}

	return &connect.Response[v1.UpdateRunnerWorkspaceStatusResponse]{
		Msg: &v1.UpdateRunnerWorkspaceStatusResponse{},
	}, nil
}

type userHandler struct {
	gitpod_experimental_v1connect.UnimplementedUserServiceHandler
}

func (userHandler) GetAuthenticatedUser(context.Context, *connect.Request[gitpod_experimental_v1.GetAuthenticatedUserRequest]) (*connect.Response[gitpod_experimental_v1.GetAuthenticatedUserResponse], error) {
	return &connect.Response[gitpod_experimental_v1.GetAuthenticatedUserResponse]{
		Msg: &gitpod_experimental_v1.GetAuthenticatedUserResponse{
			User: &gitpod_experimental_v1.User{
				Id:   "test",
				Name: "test",
			},
		},
	}, nil
}
