// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gitpod-io/gitpod/common-go/util"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Printf("Usage: %s <port> [<link label>] [<schema>]\n", os.Args[0])
		os.Exit(1)
	}
	port := os.Args[1]

	label := "Open in VS Code Desktop"
	if len(os.Args) > 2 {
		label = os.Args[2]
	}

	schema := "vscode"
	if len(os.Args) > 3 {
		schema = os.Args[3]
	}

	errlog := log.New(os.Stderr, "VS Code Desktop status: ", log.LstdFlags)

	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		wsInfo, err := GetWSInfo(context.Background())
		if err != nil {
			errlog.Printf("cannot get workspace info: %v\n", err)
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
		}

		type Query struct {
			InstanceId     string `json:"instanceId"`
			WorkspaceId    string `json:"workspaceId"`
			GitpodHost     string `json:"gitpodHost"`
			DebugWorkspace bool   `json:"debugWorkspace"`
		}
		debugWorkspace := false
		if wsInfo.GetDebugWorkspaceType() != supervisor.DebugWorkspaceType_noDebug {
			debugWorkspace = true
		}
		query := &Query{
			InstanceId:     wsInfo.InstanceId,
			WorkspaceId:    wsInfo.WorkspaceId,
			GitpodHost:     wsInfo.GitpodHost,
			DebugWorkspace: debugWorkspace,
		}
		b, err := json.Marshal(query)
		if err != nil {
			errlog.Printf("cannot marshal query: %v\n", err)
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
		}
		queryString := string(b)

		workspaceLocation := wsInfo.GetWorkspaceLocationFile()
		if workspaceLocation == "" {
			workspaceLocation = wsInfo.GetWorkspaceLocationFolder()
		}

		link := url.URL{
			Scheme:   schema,
			Host:     "gitpod.gitpod-desktop",
			Path:     workspaceLocation,
			RawQuery: url.QueryEscape(queryString),
		}

		response := make(map[string]string)
		response["link"] = link.String()
		response["label"] = label
		response["clientID"] = schema
		response["kind"] = "code-desktop"
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	fmt.Printf("Starting status proxy for desktop IDE at port %s\n", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), nil); err != nil {
		log.Fatal(err)
	}
}

func GetWSInfo(ctx context.Context) (*supervisor.WorkspaceInfoResponse, error) {
	supervisorConn, err := grpc.Dial(util.GetSupervisorAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	defer supervisorConn.Close()
	wsinfo, err := supervisor.NewInfoServiceClient(supervisorConn).WorkspaceInfo(ctx, &supervisor.WorkspaceInfoRequest{})
	if err != nil {
		return nil, xerrors.Errorf("failed getting workspace info from supervisor: %w", err)
	}
	return wsinfo, nil
}
