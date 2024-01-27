// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package loadgen

import (
	"math/rand"
	"net/url"
	"path"
	"strings"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/namegen"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// WorkspaceGenerator generates new workspace start specs
type WorkspaceGenerator interface {
	Generate() (*StartWorkspaceSpec, error)
}

// LoadGenerator abstracts load generation
type LoadGenerator interface {
	// Generate starts a new load generator. The channel will
	// produce a message every time a new workspace is to be started.
	// The generator can close the channel, at which point no more
	// new workspaces will be started.
	Generate() <-chan struct{}

	// Close stops all generators
	Close() error
}

// NewWorkspaceCountLimitingGenerator produces a new FixedAmountGenerator
func NewWorkspaceCountLimitingGenerator(delegate LoadGenerator, count int) *WorkspaceCountLimitingGenerator {
	return &WorkspaceCountLimitingGenerator{
		D:     delegate,
		Count: uint32(count),
		close: make(chan struct{}),
	}
}

// WorkspaceCountLimitingGenerator limits the amount of workspace
type WorkspaceCountLimitingGenerator struct {
	D     LoadGenerator
	Count uint32

	close chan struct{}
	c     uint32
}

// Generate starts a new load generator.
func (f *WorkspaceCountLimitingGenerator) Generate() <-chan struct{} {
	res := make(chan struct{})
	gen := f.D.Generate()
	go func() {
		defer close(res)

		for range gen {
			v := atomic.AddUint32(&f.c, 1)
			if v > f.Count {
				f.Close()
				return
			}

			select {
			case res <- struct{}{}:
			case <-f.close:
				return
			}
		}
	}()
	return res
}

// Close stops all generators
func (f *WorkspaceCountLimitingGenerator) Close() error {
	close(f.close)
	return f.D.Close()
}

// FixedWorkspaceGenerator varies only the workspace and instance IDs
type FixedWorkspaceGenerator struct {
	Template *api.StartWorkspaceRequest
}

// Generate produces a new spec
func (f *FixedWorkspaceGenerator) Generate() (*StartWorkspaceSpec, error) {
	instanceID, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}
	workspaceID, err := namegen.GenerateWorkspaceID()
	if err != nil {
		return nil, err
	}

	out := proto.Clone(f.Template).(*api.StartWorkspaceRequest)
	out.Id = instanceID.String()
	out.Metadata.MetaId = workspaceID
	out.ServicePrefix = workspaceID
	r := StartWorkspaceSpec(*out)
	return &r, nil
}

// NewFixedLoadGenerator produces a new load generator
func NewFixedLoadGenerator(delay, jitter time.Duration) *FixedLoadGenerator {
	return &FixedLoadGenerator{
		Delay:  delay,
		Jitter: jitter,
		close:  make(chan struct{}),
	}
}

// FixedLoadGenerator produces load with a fixed delay
type FixedLoadGenerator struct {
	Delay  time.Duration
	Jitter time.Duration

	close chan struct{}
}

// Generate starts a new load generator.
func (f *FixedLoadGenerator) Generate() <-chan struct{} {
	res := make(chan struct{})
	go func() {
		defer close(res)

		for {
			delay := f.Delay + time.Duration(rand.Int63()%int64(f.Jitter))
			select {
			case <-time.After(delay):
			case <-f.close:
				return
			}

			select {
			case res <- struct{}{}:
			case <-f.close:
				return
			}
		}
	}()
	return res
}

// Close stops all generators
func (f *FixedLoadGenerator) Close() error {
	close(f.close)
	return nil
}

type WorkspaceCfg struct {
	CloneURL       string                     `json:"cloneURL"`
	WorkspaceImage string                     `json:"workspaceImage"`
	CloneTarget    string                     `json:"cloneTarget"`
	Score          int                        `json:"score"`
	Environment    []*api.EnvironmentVariable `json:"environment"`
	WorkspaceClass string                     `json:"workspaceClass"`
	RepositoryAuth *RepositoryAuth            `json:"auth,omitempty"`
}

type RepositoryAuth struct {
	AuthUser     string `json:"authUser"`
	AuthPassword string `json:"authPassword"`
}

type MultiWorkspaceGenerator struct {
	Template *api.StartWorkspaceRequest
	Config   MultiGeneratorConfig
}

type MultiGeneratorConfig struct {
	Repos []WorkspaceCfg
	Auth  *RepositoryAuth
}

func (f *MultiWorkspaceGenerator) Generate() (*StartWorkspaceSpec, error) {
	instanceID, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}
	workspaceID, err := namegen.GenerateWorkspaceID()
	if err != nil {
		return nil, err
	}

	repo := selectRepo(f.Config.Repos)
	log.Infof("selecting repo %s", repo.CloneURL)

	out := proto.Clone(f.Template).(*api.StartWorkspaceRequest)
	out.Id = instanceID.String()
	out.Metadata.MetaId = workspaceID
	if out.Metadata.Annotations == nil {
		out.Metadata.Annotations = make(map[string]string)
	}

	cloneUrl, err := url.Parse(repo.CloneURL)
	if err != nil {
		return nil, err
	}
	repositoryName := strings.TrimRight(path.Base(cloneUrl.Path), ".git")
	gitConfig := f.prepareGitConfig(repo)

	out.Metadata.Annotations["context-url"] = repo.CloneURL
	out.ServicePrefix = workspaceID
	out.Spec.WorkspaceLocation = repositoryName
	out.Spec.Initializer = &csapi.WorkspaceInitializer{
		Spec: &csapi.WorkspaceInitializer_Git{
			Git: &csapi.GitInitializer{
				CheckoutLocation: repositoryName,
				CloneTaget:       repo.CloneTarget,
				RemoteUri:        repo.CloneURL,
				TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
				Config:           gitConfig,
			},
		},
	}

	out.Spec.WorkspaceImage = repo.WorkspaceImage
	if len(repo.WorkspaceClass) > 0 {
		out.Spec.Class = repo.WorkspaceClass
	}
	out.Spec.Envvars = append(out.Spec.Envvars, repo.Environment...)
	r := StartWorkspaceSpec(*out)
	return &r, nil
}

func selectRepo(repos []WorkspaceCfg) WorkspaceCfg {
	var scoreSum int
	for _, repo := range repos {
		scoreSum += repo.Score
	}

	r := rand.Float32()
	var normalizedSum float32
	for _, repo := range repos {
		normalized := float32(repo.Score) / float32(scoreSum)
		normalizedSum += normalized
		if r < normalizedSum {
			return repo
		}
	}

	return repos[len(repos)-1]
}

func (f *MultiWorkspaceGenerator) prepareGitConfig(repo WorkspaceCfg) *csapi.GitConfig {
	gitConfig := &csapi.GitConfig{
		Authentication: csapi.GitAuthMethod_NO_AUTH,
	}
	if f.Config.Auth != nil {
		gitConfig.Authentication = csapi.GitAuthMethod_BASIC_AUTH
		gitConfig.AuthUser = f.Config.Auth.AuthUser
		gitConfig.AuthPassword = f.Config.Auth.AuthPassword
	}

	if repo.RepositoryAuth != nil {
		gitConfig.Authentication = csapi.GitAuthMethod_BASIC_AUTH
		gitConfig.AuthUser = repo.RepositoryAuth.AuthUser
		gitConfig.AuthPassword = repo.RepositoryAuth.AuthPassword
	}

	return gitConfig
}
