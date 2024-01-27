// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registry

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/containerd/containerd/remotes"
	"github.com/containerd/containerd/remotes/docker"
	httpapi "github.com/ipfs/kubo/client/rpc"
	oldcmds "github.com/ipfs/kubo/commands"
	config "github.com/ipfs/kubo/config"
	"github.com/ipfs/kubo/core"
	"github.com/ipfs/kubo/core/corehttp"
	"github.com/ipfs/kubo/plugin/loader"
	"github.com/ipfs/kubo/repo/fsrepo"
	ma "github.com/multiformats/go-multiaddr"
	"github.com/opencontainers/go-digest"
	redis "github.com/redis/go-redis/v9"

	rfapi "github.com/gitpod-io/gitpod/registry-facade/api"
)

var loadPluginsOnce sync.Once

// setupPlugins load plugins
func setupPlugins(externalPluginsPath string) error {
	// Load any external plugins if available on externalPluginsPath
	plugins, err := loader.NewPluginLoader(filepath.Join(externalPluginsPath, "plugins"))
	if err != nil {
		return fmt.Errorf("error loading plugins: %s", err)
	}

	// Load preloaded and external plugins
	if err := plugins.Initialize(); err != nil {
		return fmt.Errorf("error initializing plugins: %s", err)
	}

	if err := plugins.Inject(); err != nil {
		return fmt.Errorf("error initializing plugins: %s", err)
	}

	return nil
}

// createIPFSConfig creates a config with default options and a 2048 bit key
func createIPFSConfig() (*config.Config, error) {
	return config.Init(io.Discard, 2048)
}

// createTempRepo creates the repo according to the config
func createTempRepo(cfg *config.Config) (string, error) {
	// Create temporal directory
	repoPath, err := os.MkdirTemp("", "ipfs-shell")
	if err != nil {
		return "", fmt.Errorf("failed to create temp dir: %s", err)
	}

	// Create the repo with the config
	err = fsrepo.Init(repoPath, cfg)
	if err != nil {
		return "", fmt.Errorf("failed to init ephemeral node: %s", err)
	}
	return repoPath, nil
}

func TestIPFSBlobCache(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Create IPFS configuration
	ipfsCfg, err := createIPFSConfig()
	if err != nil {
		t.Fatalf("fail to create ipfs configuration: %v", err)
	}
	if len(ipfsCfg.Addresses.API) == 0 {
		t.Fatal("the configuration must have api address")
	}
	ipfsAPIAddr := ipfsCfg.Addresses.API[0]

	// Load plugins
	var onceErr error
	loadPluginsOnce.Do(func() {
		onceErr = setupPlugins("")
	})
	if onceErr != nil {
		t.Fatalf("fail to setup plugins: %v", onceErr)
	}

	// Create a temporal repo
	ipfsRepoPath, err := createTempRepo(ipfsCfg)
	if err != nil {
		t.Fatalf("fail to create temp repo: %v", err)
	}
	defer os.RemoveAll(ipfsRepoPath)

	cctx := &oldcmds.Context{
		ConfigRoot: ipfsRepoPath,
		ReqLog:     &oldcmds.ReqLog{},
		// Plugins:    plugins,
		ConstructNode: func() (n *core.IpfsNode, err error) {
			r, err := fsrepo.Open(ipfsRepoPath)
			if err != nil { // repo is owned by the node
				return nil, err
			}

			// ok everything is good. set it on the invocation (for ownership)
			// and return it.
			n, err = core.NewNode(ctx, &core.BuildCfg{
				Online: true,
				Repo:   r,
			})
			if err != nil {
				return nil, err
			}

			return n, nil
		},
	}

	// Construct IPFS node
	node, err := cctx.ConstructNode()
	if err != nil {
		t.Fatalf("fail to construct node: %v", err)
	}
	defer node.Close()

	go func() {
		// Create a IPFS server
		t.Logf("HTTP API server listening on %s\n", ipfsAPIAddr)
		corehttp.ListenAndServe(node, ipfsAPIAddr, corehttp.CommandsOption(*cctx))
	}()

	// Init HTTP client connects to IPFS server
	ipfsAPIMaddr, err := ma.NewMultiaddr(ipfsAPIAddr)
	if err != nil {
		t.Fatalf("fail to new multi address: %v", err)
	}

	api, err := httpapi.NewApiWithClient(ipfsAPIMaddr, NewRetryableHTTPClient())
	if err != nil {
		t.Fatal(err)
	}

	// Running unit tests
	redisServer, err := miniredis.Run()
	if err != nil {
		t.Fatalf("cannot run mini redis server: %v", err)
	}
	defer redisServer.Close()

	redisC := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})

	redisBlobStore := &RedisBlobStore{Client: redisC}
	ipfsBlobCache := &IPFSBlobCache{Redis: redisC, IPFS: api}
	ipfsBlobSrc := ipfsBlobSource{source: ipfsBlobCache}
	imageSpec := &rfapi.ImageSpec{BaseRef: "docker.io/library/alpine@sha256:7580ece7963bfa863801466c0a488f11c86f85d9988051a9f9c68cb27f6b7872"}
	dgst := digest.NewDigestFromBytes(digest.SHA256, []byte("7580ece7963bfa863801466c0a488f11c86f85d9988051a9f9c68cb27f6b7872"))
	mediaType := "application/vnd.docker.image.rootfs.diff.tar.gzip"

	err = ipfsBlobCache.Store(ctx, dgst, io.NopCloser(bytes.NewReader([]byte("foobar"))), mediaType)
	if err != nil {
		t.Fatalf("cannot store to ipfs blobcache: %v", err)
	}

	exist := ipfsBlobSrc.HasBlob(ctx, imageSpec, dgst)
	if !exist {
		t.Fatal("the digest should exists")
	}

	resolverFactory := func() remotes.Resolver {
		client := NewRetryableHTTPClient()
		resolverOpts := docker.ResolverOptions{Client: client}
		return docker.NewResolver(resolverOpts)
	}

	blobHandler := &blobHandler{
		Context: ctx,
		Digest:  dgst,
		Name:    "unittest",

		Spec:     imageSpec,
		Resolver: resolverFactory(),
		Store:    redisBlobStore,
		IPFS:     ipfsBlobCache,
	}

	req := httptest.NewRequest("", "http://example.com", nil)
	w := newFailFirstResponseWriter()

	blobHandler.getBlob(w, req)
}

type failFirstResponseWriter struct {
	code      int
	headerMap http.Header
	body      *bytes.Buffer

	requests int
}

func newFailFirstResponseWriter() *failFirstResponseWriter {
	return &failFirstResponseWriter{
		headerMap: make(http.Header),
		body:      new(bytes.Buffer),
		code:      200,
	}
}

func (rw *failFirstResponseWriter) Header() http.Header {
	m := rw.headerMap
	if m == nil {
		m = make(http.Header)
		rw.headerMap = m
	}
	return m
}

func (rw *failFirstResponseWriter) Write(buf []byte) (int, error) {
	defer func() {
		rw.requests += 1
	}()

	if rw.requests == 0 {
		return 0, syscall.ECONNRESET
	}
	if rw.requests == 1 {
		return 0, syscall.EPIPE
	}

	if rw.body != nil {
		rw.body.Write(buf)
	}
	return len(buf), nil
}

func (rw *failFirstResponseWriter) WriteHeader(code int) {
	rw.code = code
}
