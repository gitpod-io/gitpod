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

	"github.com/bufbuild/connect-go"
	gitpod_experimental_v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	gitpod_experimental_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	gitpod_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/v1/v1connect"
	"github.com/google/uuid"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	hdlr := &handler{
		cond: sync.NewCond(&sync.Mutex{}),
	}

	mux := http.NewServeMux()
	mux.Handle("/api/start/", http.StripPrefix("/api/start/", http.HandlerFunc(hdlr.StartWorkspaceFromContext)))

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

type handler struct {
	gitpod_v1connect.UnimplementedWorkspaceRunnerServiceHandler

	Workspaces []*v1.RunnerWorkspace
	cond       *sync.Cond
}

func (h *handler) StartWorkspaceFromContext(rw http.ResponseWriter, req *http.Request) {
	slog.Info("start workspace from context", "path", req.URL.Path)

	init, err := parseContext(req.URL.Path)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
	}

	h.cond.L.Lock()
	h.Workspaces = append(h.Workspaces, &v1.RunnerWorkspace{
		Id:           generateRandomWorkspaceID(),
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
	})
	h.cond.Broadcast()
	defer h.cond.L.Unlock()

	rw.WriteHeader(http.StatusOK)
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

	remoteURI := fmt.Sprintf("https://github.com/%s/%s.git", parts[0], parts[1])
	checkoutLocation := parts[1]

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
					},
				},
			},
		},
	}, nil
}

func (h *handler) RegisterRunner(ctx context.Context, req *connect.Request[v1.RegisterRunnerRequest]) (*connect.Response[v1.RegisterRunnerResponse], error) {
	runnerID := uuid.Must(uuid.NewRandom()).String()
	slog.Info("register runner", "scope", req.Msg.Scope, "runnerID", runnerID)
	return &connect.Response[v1.RegisterRunnerResponse]{
		Msg: &v1.RegisterRunnerResponse{
			ClusterId: runnerID,
		},
	}, nil
}

func (h *handler) RenewRunnerRegistration(ctx context.Context, req *connect.Request[v1.RenewRunnerRegistrationRequest]) (*connect.Response[v1.RenewRunnerRegistrationResponse], error) {
	return &connect.Response[v1.RenewRunnerRegistrationResponse]{
		Msg: &v1.RenewRunnerRegistrationResponse{},
	}, nil
}

func (h *handler) ListRunnerWorkspaces(ctx context.Context, req *connect.Request[v1.ListRunnerWorkspacesRequest]) (*connect.Response[v1.ListRunnerWorkspacesResponse], error) {
	return &connect.Response[v1.ListRunnerWorkspacesResponse]{
		Msg: &v1.ListRunnerWorkspacesResponse{
			Pagination: &v1.PaginationResponse{Total: int32(len(h.Workspaces))},
			Workspaces: h.Workspaces,
		},
	}, nil
}

func (h *handler) WatchRunnerWorkspaces(ctx context.Context, req *connect.Request[v1.WatchRunnerWorkspacesRequest], srv *connect.ServerStream[v1.WatchRunnerWorkspacesResponse]) error {
	for {
		h.cond.L.Lock()
		h.cond.Wait()
		for _, ws := range h.Workspaces {
			err := srv.Send(&v1.WatchRunnerWorkspacesResponse{
				ClusterId: "cluster-id-goes-here",
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
