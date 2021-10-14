// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package streams

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sync"

	securejoin "github.com/cyphar/filepath-securejoin"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"go.etcd.io/etcd/server/v3/wal"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

type DirectAccessFactory func() (storage.DirectAccess, error)

func NewStreamsServer(workingDir string, storage DirectAccessFactory, hostname string) (*StreamsServer, error) {
	r := mux.NewRouter()
	res := &StreamsServer{
		WorkingDir:     workingDir,
		StorageFactory: storage,
		Hostname:       hostname,
		streams:        make(map[string]*stream),
		mux:            r,
	}

	r.HandleFunc("/write/{writeKey}/{id}", res.handleWrite)
	r.HandleFunc("/read/{id}", res.handleRead)

	return res, nil
}

type StreamsServer struct {
	WorkingDir     string
	StorageFactory DirectAccessFactory
	Hostname       string

	mux *mux.Router

	streams map[string]*stream
	mu      sync.RWMutex

	api.UnimplementedLogStreamServiceServer
}

type stream struct {
	WAL      *wal.WAL
	Phase    streamPhase
	WriteKey string
	Storage  storage.DirectAccess
}

type streamPhase int

const (
	streamPhaseWriting streamPhase = iota
	streamPhaseCommiting
)

func (srv *StreamsServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	srv.mux.ServeHTTP(w, r)
}

func (srv *StreamsServer) handleWrite(w http.ResponseWriter, r *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()

	vars := mux.Vars(r)
	stream, ok := srv.streams[vars["id"]]
	if !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

}

func (srv *StreamsServer) StartStream(ctx context.Context, req *api.StartStreamRequest) (*api.StartStreamResponse, error) {
	_, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "ID is not a valid UID: %v", err)
	}
	loc, err := securejoin.SecureJoin(srv.WorkingDir, req.Id)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	if _, err := os.Stat(loc); !os.IsNotExist(err) {
		return nil, status.Errorf(codes.AlreadyExists, "stream already exists")
	}

	writeKey, err := uuid.NewRandom()
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot produce access key: %v", err)
	}
	url := srv.url(req.Id, "write", writeKey.String())

	srv.mu.Lock()
	defer srv.mu.Unlock()

	if _, ok := srv.streams[req.Id]; ok {
		return nil, status.Errorf(codes.AlreadyExists, "stream already exists")
	}

	md, err := proto.Marshal(req)
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot remarshal request: %v", err)
	}

	remoteStorage, err := srv.StorageFactory()
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot create remote storage: %v", err)
	}
	err = remoteStorage.Init(ctx, req.OwnerId, req.WorkspaceId, req.InstanceId)
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot init remote storage: %v", err)
	}

	storage, err := wal.Create(nil, loc, md)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot open WAL: %v", err)
	}
	srv.streams[req.Id] = &stream{
		WAL:      storage,
		Phase:    streamPhaseWriting,
		WriteKey: writeKey.String(),
		Storage:  remoteStorage,
	}

	return &api.StartStreamResponse{
		Url: url,
	}, nil
}

func (srv *StreamsServer) url(id, action, writeKey string) string {
	if action == "write" {
		return fmt.Sprintf("https://%s/%s/%s/%s", srv.Hostname, action, writeKey, id)
	}

	return fmt.Sprintf("https://%s/%s/%s", srv.Hostname, action, id)
}

// CommitStream(context.Context, *CommitStreamRequest) (*CommitStreamResponse, error)

func (srv *StreamsServer) AccessStream(ctx context.Context, req *api.AccessStreamRequest) (*api.AccessStreamResponse, error) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()

	_, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "ID is not a valid UID: %v", err)
	}
	if _, ok := srv.streams[req.Id]; !ok {
		return nil, status.Errorf(codes.NotFound, "stream does not exist")
	}

	url := srv.url(req.Id, "read", "")

	return &api.AccessStreamResponse{
		Url: url,
	}, nil
}
