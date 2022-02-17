// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	grpcruntime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/prometheus/procfs"
	"github.com/soheilhy/cmux"
	"golang.org/x/crypto/ssh"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/executor"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/activation"
	"github.com/gitpod-io/gitpod/supervisor/pkg/config"
	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"
	"github.com/gitpod-io/gitpod/supervisor/pkg/ports"
	"github.com/gitpod-io/gitpod/supervisor/pkg/terminal"
)

const (
	gitpodUID       = 33333
	gitpodUserName  = "gitpod"
	gitpodGID       = 33333
	gitpodGroupName = "gitpod"
	desktopIDEPort  = 24000
)

var (
	additionalServices []RegisterableService
	apiEndpointOpts    []grpc.ServerOption
	Version            = ""
)

// RegisterAdditionalService registers additional services for the API endpoint
// of supervisor.
func RegisterAdditionalService(services ...RegisterableService) {
	additionalServices = append(additionalServices, services...)
}

// AddAPIEndpointOpts adds additional grpc server options for the API endpoint.
func AddAPIEndpointOpts(opts ...grpc.ServerOption) {
	apiEndpointOpts = append(apiEndpointOpts, opts...)
}

type runOptions struct {
	Args []string
}

// RunOption customizes the run behaviour.
type RunOption func(*runOptions)

// WithArgs sets the arguments passed to Run.
func WithArgs(args []string) RunOption {
	return func(r *runOptions) {
		r.Args = args
	}
}

// The sum of those timeBudget* times has to fit within the terminationGracePeriod of the workspace pod.
const (
	timeBudgetIDEShutdown = 5 * time.Second
)

const (
	// KindGitpod marks tokens that provide access to the Gitpod server API.
	KindGitpod = "gitpod"

	// KindGit marks any kind of Git access token.
	KindGit = "git"
)

type ShutdownReason int16

const (
	ShutdownReasonSuccess        ShutdownReason = 0
	ShutdownReasonExecutionError ShutdownReason = 1
)

type IDEKind int64

const (
	WebIDE IDEKind = iota
	DesktopIDE
)

func (s IDEKind) String() string {
	switch s {
	case WebIDE:
		return "IDE"
	case DesktopIDE:
		return "Desktop IDE"
	}
	return "unknown"
}

// Run serves as main entrypoint to the supervisor.
func Run(options ...RunOption) {
	exitCode := 0
	defer handleExit(&exitCode)

	opts := runOptions{
		Args: os.Args,
	}
	for _, o := range options {
		o(&opts)
	}

	cfg, err := GetConfig()
	if err != nil {
		log.WithError(err).Fatal("configuration error")
	}
	if len(os.Args) < 2 || os.Args[1] != "run" {
		fmt.Println("supervisor makes sure your workspace/IDE keeps running smoothly.\nYou don't have to call this thing, Gitpod calls it for you.")
		return
	}

	// BEWARE: we can only call buildChildProcEnv once, because it might download env vars from a one-time-secret
	//         URL, which would fail if we tried another time.
	childProcEnvvars := buildChildProcEnv(cfg, nil)

	err = AddGitpodUserIfNotExists()
	if err != nil {
		log.WithError(err).Fatal("cannot ensure Gitpod user exists")
	}
	symlinkBinaries(cfg)
	configureGit(cfg, childProcEnvvars)

	tokenService := NewInMemoryTokenService()
	tkns, err := cfg.GetTokens(true)
	if err != nil {
		log.WithError(err).Warn("cannot prepare tokens")
	}
	for i := range tkns {
		_, err = tokenService.SetToken(context.Background(), &tkns[i].SetTokenRequest)
		if err != nil {
			log.WithError(err).Warn("cannot prepare tokens")
		}
	}

	tunneledPortsService := ports.NewTunneledPortsService(cfg.DebugEnable)
	_, err = tunneledPortsService.Tunnel(context.Background(), &ports.TunnelOptions{
		SkipIfExists: false,
	}, &ports.PortTunnelDescription{
		LocalPort:  uint32(cfg.APIEndpointPort),
		TargetPort: uint32(cfg.APIEndpointPort),
		Visibility: api.TunnelVisiblity_host,
	}, &ports.PortTunnelDescription{
		LocalPort:  uint32(cfg.SSHPort),
		TargetPort: uint32(cfg.SSHPort),
		Visibility: api.TunnelVisiblity_host,
	})
	if err != nil {
		log.WithError(err).Warn("cannot tunnel internal ports")
	}

	var slirp ports.SlirpClient
	if _, err := os.Stat("/.supervisor/slirp4netns.sock/slirp4netns.sock"); err == nil {
		slirp = ports.Slirp4Netns("/.supervisor/slirp4netns.sock/slirp4netns.sock")
	}

	ctx, cancel := context.WithCancel(context.Background())

	internalPorts := []uint32{uint32(cfg.IDEPort), uint32(cfg.APIEndpointPort), uint32(cfg.SSHPort)}
	if cfg.DesktopIDE != nil {
		internalPorts = append(internalPorts, desktopIDEPort)
	}

	var (
		shutdown                           = make(chan ShutdownReason, 1)
		ideReady                           = &ideReadyState{cond: sync.NewCond(&sync.Mutex{})}
		desktopIdeReady     *ideReadyState = nil
		cstate                             = NewInMemoryContentState(cfg.RepoRoot)
		gitpodService                      = createGitpodService(cfg, tokenService)
		gitpodConfigService                = config.NewConfigService(cfg.RepoRoot+"/.gitpod.yml", cstate.ContentReady(), log.Log)
		portMgmt                           = ports.NewManager(
			createExposedPortsImpl(cfg, gitpodService),
			&ports.PollingServedPortsObserver{
				RefreshInterval: 2 * time.Second,
			},
			ports.NewConfigService(cfg.WorkspaceID, gitpodConfigService, gitpodService),
			tunneledPortsService,
			slirp,
			internalPorts...,
		)
		termMux             = terminal.NewMux()
		termMuxSrv          = terminal.NewMuxTerminalService(termMux)
		taskManager         = newTasksManager(cfg, termMuxSrv, cstate, nil)
		analytics           = analytics.NewFromEnvironment()
		notificationService = NewNotificationService()
	)
	if cfg.DesktopIDE != nil {
		desktopIdeReady = &ideReadyState{cond: sync.NewCond(&sync.Mutex{})}
	}
	tokenService.provider[KindGit] = []tokenProvider{NewGitTokenProvider(gitpodService, cfg.WorkspaceConfig, notificationService)}

	go gitpodConfigService.Watch(ctx)

	defer analytics.Close()
	go analyseConfigChanges(ctx, cfg, analytics, gitpodConfigService)

	termMuxSrv.DefaultWorkdir = cfg.RepoRoot
	if cfg.WorkspaceRoot != "" {
		termMuxSrv.DefaultWorkdirProvider = func() string {
			<-cstate.ContentReady()
			stat, err := os.Stat(cfg.WorkspaceRoot)
			if err != nil {
				log.WithError(err).Error("default workdir provider: cannot resolve the workspace root")
			} else if stat.IsDir() {
				return cfg.WorkspaceRoot
			}
			return ""
		}
	}
	termMuxSrv.Env = childProcEnvvars
	termMuxSrv.DefaultCreds = &syscall.Credential{
		Uid: gitpodUID,
		Gid: gitpodGID,
	}

	apiServices := []RegisterableService{
		&statusService{
			ContentState:    cstate,
			Ports:           portMgmt,
			Tasks:           taskManager,
			ideReady:        ideReady,
			desktopIdeReady: desktopIdeReady,
		},
		termMuxSrv,
		RegistrableTokenService{Service: tokenService},
		notificationService,
		&InfoService{cfg: cfg, ContentState: cstate},
		&ControlService{portsManager: portMgmt},
		&portService{portsManager: portMgmt},
	}
	apiServices = append(apiServices, additionalServices...)

	if !cfg.isHeadless() {
		// We need to checkout dotfiles first, because they may be changing the path which affects the IDE.
		// TODO(cw): provide better feedback if the IDE start fails because of the dotfiles (provide any feedback at all).
		installDotfiles(ctx, cfg, tokenService, childProcEnvvars)
	}

	var ideWG sync.WaitGroup
	ideWG.Add(1)
	go startAndWatchIDE(ctx, cfg, &cfg.IDE, childProcEnvvars, &ideWG, ideReady, WebIDE)
	if cfg.DesktopIDE != nil {
		ideWG.Add(1)
		go startAndWatchIDE(ctx, cfg, cfg.DesktopIDE, childProcEnvvars, &ideWG, desktopIdeReady, DesktopIDE)
	}

	var wg sync.WaitGroup
	wg.Add(1)
	go startContentInit(ctx, cfg, &wg, cstate)
	wg.Add(1)
	go startAPIEndpoint(ctx, cfg, &wg, apiServices, tunneledPortsService, apiEndpointOpts...)
	wg.Add(1)
	go startSSHServer(ctx, cfg, &wg, childProcEnvvars)
	wg.Add(1)
	tasksSuccessChan := make(chan taskSuccess, 1)
	go taskManager.Run(ctx, &wg, tasksSuccessChan)
	wg.Add(1)
	go socketActivationForDocker(ctx, &wg, termMux)

	if cfg.isHeadless() {
		wg.Add(1)
		go stopWhenTasksAreDone(ctx, &wg, shutdown, tasksSuccessChan)
	} else {
		wg.Add(1)
		go portMgmt.Run(ctx, &wg)
	}

	if cfg.PreventMetadataAccess {
		go func() {
			if !hasMetadataAccess() {
				return
			}

			log.Error("metadata access is possible - shutting down")
			shutdown <- ShutdownReasonExecutionError
		}()
	}

	if !cfg.isHeadless() {
		go func() {
			<-cstate.ContentReady()

			start := time.Now()
			defer func() {
				log.Debugf("unshallow of local repository took %v", time.Since(start))
			}()

			cmd := runAsGitpodUser(exec.Command("git", "fetch", "--unshallow", "--tags"))
			cmd.Env = childProcEnvvars
			cmd.Dir = cfg.RepoRoot
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			err := cmd.Run()
			if err != nil {
				log.WithError(err).Error("git fetch error")
			}
		}()
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	select {
	case <-sigChan:
	case shutdownReason := <-shutdown:
		exitCode = int(shutdownReason)
	}

	log.Info("received SIGTERM (or shutdown) - tearing down")
	cancel()
	err = termMux.Close()
	if err != nil {
		log.WithError(err).Error("terminal closure failed")
	}

	// terminate all child processes once the IDE is gone
	ideWG.Wait()
	terminateChildProcesses()

	wg.Wait()
}

func installDotfiles(ctx context.Context, cfg *Config, tokenService *InMemoryTokenService, childProcEnvvars []string) {
	repo := cfg.DotfileRepo
	if repo == "" {
		return
	}

	const dotfilePath = "/home/gitpod/.dotfiles"
	if _, err := os.Stat(dotfilePath); err == nil {
		// dotfile path exists already - nothing to do here
		return
	}

	prep := func(cfg *Config, out io.Writer, name string, args ...string) *exec.Cmd {
		cmd := exec.Command(name, args...)
		cmd.Dir = "/home/gitpod"
		cmd.Env = childProcEnvvars
		cmd.SysProcAttr = &syscall.SysProcAttr{
			// All supervisor children run as gitpod user. The environment variables we produce are also
			// gitpod user specific.
			Credential: &syscall.Credential{
				Uid: gitpodUID,
				Gid: gitpodGID,
			},
		}
		cmd.Stdout = out
		cmd.Stderr = out
		return cmd
	}

	err := func() (err error) {
		out, err := os.OpenFile("/home/gitpod/.dotfiles.log", os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
		if err != nil {
			return err
		}
		defer out.Close()

		defer func() {
			if err != nil {
				out.WriteString(fmt.Sprintf("# dotfile init failed: %s\n", err.Error()))
			}
		}()

		done := make(chan error, 1)
		go func() {
			repoUrl, err := url.Parse(repo)
			if err != nil {
				done <- err
				close(done)
				return
			}
			authProvider := func() (username string, password string, err error) {
				resp, err := tokenService.GetToken(ctx, &api.GetTokenRequest{
					Host: repoUrl.Host,
					Kind: KindGit,
				})
				if err != nil {
					return
				}
				username = resp.User
				password = resp.Token
				return
			}
			client := &git.Client{
				AuthProvider: authProvider,
				AuthMethod:   git.BasicAuth,
				Location:     dotfilePath,
				RemoteURI:    repo,
			}
			done <- client.Clone(ctx)
			close(done)
		}()
		select {
		case err := <-done:
			if err != nil {
				return err
			}
		case <-time.After(120 * time.Second):
			return xerrors.Errorf("dotfiles repo clone did not finish within two minutes")
		}

		filepath.Walk(dotfilePath, func(name string, info os.FileInfo, err error) error {
			if err == nil {
				err = os.Chown(name, gitpodUID, gitpodGID)
			}
			return err
		})

		// at this point we have the dotfile repo cloned, let's try and install it
		var candidates = []string{
			"install.sh",
			"install",
			"bootstrap.sh",
			"bootstrap",
			"script/bootstrap",
			"setup.sh",
			"setup",
			"script/setup",
		}
		for _, c := range candidates {
			fn := filepath.Join(dotfilePath, c)
			stat, err := os.Stat(fn)
			if err != nil {
				_, _ = out.WriteString(fmt.Sprintf("# installation script candidate %s is not available\n", fn))
				continue
			}
			if stat.IsDir() {
				_, _ = out.WriteString(fmt.Sprintf("# installation script candidate %s is a directory\n", fn))
				continue
			}
			if stat.Mode()&0111 == 0 {
				_, _ = out.WriteString(fmt.Sprintf("# installation script candidate %s is not executable\n", fn))
				continue
			}

			_, _ = out.WriteString(fmt.Sprintf("# executing installation script candidate %s\n", fn))

			// looks like we've found a candidate, let's run it
			cmd := prep(cfg, out, "/bin/sh", "-c", "exec "+fn)
			err = cmd.Start()
			if err != nil {
				return err
			}
			done := make(chan error, 1)
			go func() {
				done <- cmd.Wait()
				close(done)
			}()

			select {
			case err = <-done:
				return err
			case <-time.After(120 * time.Second):
				cmd.Process.Kill()
				return xerrors.Errorf("installation process %s tool longer than 120 seconds", fn)
			}
		}

		// no installation script candidate was found, let's try and symlink this stuff
		err = filepath.Walk(dotfilePath, func(path string, info fs.FileInfo, err error) error {
			if strings.Contains(path, "/.git") {
				// don't symlink the .git directory or any of its content
				return nil
			}

			homeFN := filepath.Join("/home/gitpod", strings.TrimPrefix(path, dotfilePath))
			if _, err := os.Stat(homeFN); err == nil {
				// homeFN exists already - do nothing
				return nil
			}

			if info.IsDir() {
				err = os.MkdirAll(homeFN, info.Mode().Perm())
				if err != nil {
					return err
				}
				return nil
			}

			// write some feedback to the terminal
			out.WriteString(fmt.Sprintf("# echo linking %s -> %s\n", path, homeFN))

			return os.Symlink(path, homeFN)
		})

		return nil
	}()
	if err != nil {
		// installing the dotfiles failed for some reason - we must tell the user
		// TODO(cw): tell the user
		log.WithError(err).Warn("installing dotfiles failed")
	}
}

func createGitpodService(cfg *Config, tknsrv api.TokenServiceServer) *gitpod.APIoverJSONRPC {
	endpoint, host, err := cfg.GitpodAPIEndpoint()
	if err != nil {
		log.WithError(err).Fatal("cannot find Gitpod API endpoint")
		return nil
	}
	tknres, err := tknsrv.GetToken(context.Background(), &api.GetTokenRequest{
		Kind: KindGitpod,
		Host: host,
		Scope: []string{
			"function:getToken",
			"function:openPort",
			"function:getOpenPorts",
			"function:guessGitTokenScopes",
		},
	})
	if err != nil {
		log.WithError(err).Error("cannot get token for Gitpod API")
		return nil
	}

	gitpodService, err := gitpod.ConnectToServer(endpoint, gitpod.ConnectToServerOpts{
		Token: tknres.Token,
		Log:   log.Log,
		ExtraHeaders: map[string]string{
			"User-Agent":              "gitpod/supervisor",
			"X-Workspace-Instance-Id": cfg.WorkspaceInstanceID,
			"X-Client-Version":        Version,
		},
	})
	if err != nil {
		log.WithError(err).Error("cannot connect to Gitpod API")
		return nil
	}
	return gitpodService
}

func createExposedPortsImpl(cfg *Config, gitpodService *gitpod.APIoverJSONRPC) ports.ExposedPortsInterface {
	if gitpodService == nil {
		log.Error("auto-port exposure won't work")
		return &ports.NoopExposedPorts{}
	}
	return ports.NewGitpodExposedPorts(cfg.WorkspaceID, cfg.WorkspaceInstanceID, gitpodService)
}

// supervisor ships some binaries we want in the PATH. We could just add some directory to the path, but
// instead of producing a strange path setup, we symlink the binary to /usr/bin.
func symlinkBinaries(cfg *Config) {
	bin, err := os.Executable()
	if err != nil {
		log.WithError(err).Error("cannot get executable path - hence cannot symlink binaries")
		return
	}
	base := filepath.Dir(bin)

	binaries := map[string]string{
		"gitpod-cli": "gp",
	}
	for k, v := range binaries {
		var (
			from = filepath.Join(base, k)
			to   = filepath.Join("/usr/bin", v)
		)

		// remove possibly existing symlink target
		if err = os.Remove(to); err != nil && !os.IsNotExist(err) {
			log.WithError(err).WithField("to", to).Warn("cannot remove possibly existing symlink target")
		}

		err = os.Symlink(from, to)
		if err != nil {
			log.WithError(err).WithField("from", from).WithField("to", to).Warn("cannot create symlink")
		}
	}
}

func configureGit(cfg *Config, childProcEnvvars []string) {
	settings := [][]string{
		{"push.default", "simple"},
		{"alias.lg", "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"},
		{"credential.helper", "/usr/bin/gp credential-helper"},
	}
	if cfg.GitUsername != "" {
		settings = append(settings, []string{"user.name", cfg.GitUsername})
	}
	if cfg.GitEmail != "" {
		settings = append(settings, []string{"user.email", cfg.GitEmail})
	}

	for _, s := range settings {
		cmd := exec.Command("git", append([]string{"config", "--global"}, s...)...)
		cmd = runAsGitpodUser(cmd)
		cmd.Env = childProcEnvvars
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err := cmd.Run()
		if err != nil {
			log.WithError(err).WithField("args", s).Warn("git config error")
		}
	}
}

func hasMetadataAccess() bool {
	// curl --connect-timeout 10 -s -H "Metadata-Flavor: Google" 'http://169.254.169.254/computeMetadata/v1/instance/'
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	req, err := http.NewRequest("GET", "http://169.254.169.254/computeMetadata/v1/instance/", nil)
	if err != nil {
		log.WithError(err).Error("cannot check metadata access - this should never happen")
		return true
	}
	req.Header.Add("Metadata-Flavor", "Google")

	resp, err := client.Do(req)
	// We did not see an error. That's a problem because that means that users can reach the metadata endpoint.
	if err == nil {
		resp.Body.Close()
		return true
	}

	// if we see any error here we're good because then the request timed out or failed for some other reason.
	return false
}

type ideStatus int

const (
	statusNeverRan ideStatus = iota
	statusShouldRun
	statusShouldShutdown
)

func startAndWatchIDE(ctx context.Context, cfg *Config, ideConfig *IDEConfig, childProcEnvvars []string, wg *sync.WaitGroup, ideReady *ideReadyState, ide IDEKind) {
	defer wg.Done()
	defer log.WithField("ide", ide.String()).Debug("startAndWatchIDE shutdown")

	if cfg.isHeadless() {
		ideReady.Set(true, nil)
		return
	}

	ideStatus := statusNeverRan

	var (
		cmd        *exec.Cmd
		ideStopped chan struct{}
	)
supervisorLoop:
	for {
		if ideStatus == statusShouldShutdown {
			break
		}

		ideStopped = make(chan struct{}, 1)
		cmd = prepareIDELaunch(cfg, ideConfig, childProcEnvvars)
		launchIDE(cfg, ideConfig, cmd, ideStopped, ideReady, &ideStatus, ide)

		select {
		case <-ideStopped:
			// kill all processes in same pgid
			_ = syscall.Kill(-1*cmd.Process.Pid, syscall.SIGKILL)
			// IDE was stopped - let's just restart it after a small delay (in case the IDE doesn't start at all) in the next round
			if ideStatus == statusShouldShutdown {
				break supervisorLoop
			}
			time.Sleep(1 * time.Second)
		case <-ctx.Done():
			// we've been asked to shut down
			ideStatus = statusShouldShutdown
			if cmd == nil || cmd.Process == nil {
				log.WithField("ide", ide.String()).Error("cmd or cmd.Process is nil, cannot send Interrupt signal")
			} else {
				_ = cmd.Process.Signal(os.Interrupt)
			}
			break supervisorLoop
		}
	}

	log.WithField("ide", ide.String()).WithField("budget", timeBudgetIDEShutdown.String()).Info("IDE supervisor loop ended - waiting for IDE to come down")
	select {
	case <-ideStopped:
		log.WithField("ide", ide.String()).WithField("budget", timeBudgetIDEShutdown.String()).Info("IDE has been stopped in time")
		return
	case <-time.After(timeBudgetIDEShutdown):
		log.WithField("ide", ide.String()).WithField("timeBudgetIDEShutdown", timeBudgetIDEShutdown.String()).Error("IDE did not stop in time - sending SIGKILL")
		if cmd == nil || cmd.Process == nil {
			log.WithField("ide", ide.String()).Error("cmd or cmd.Process is nil, cannot send SIGKILL")
		} else {
			_ = cmd.Process.Signal(syscall.SIGKILL)
		}
	}
}

func launchIDE(cfg *Config, ideConfig *IDEConfig, cmd *exec.Cmd, ideStopped chan struct{}, ideReady *ideReadyState, s *ideStatus, ide IDEKind) {
	go func() {
		// prepareIDELaunch sets Pdeathsig, which on on Linux, will kill the
		// child process when the thread dies, not when the process dies.
		// runtime.LockOSThread ensures that as long as this function is
		// executing that OS thread will still be around.
		//
		// see https://github.com/golang/go/issues/27505#issuecomment-713706104
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		err := cmd.Start()
		if err != nil {
			if s == func() *ideStatus { i := statusNeverRan; return &i }() {
				log.WithField("ide", ide.String()).WithError(err).Fatal("IDE failed to start")
			}

			return
		}
		s = func() *ideStatus { i := statusShouldRun; return &i }()

		go func() {
			IDEStatus := runIDEReadinessProbe(cfg, ideConfig, ide)
			ideReady.Set(true, IDEStatus)
		}()

		err = cmd.Wait()
		if err != nil {
			log.WithField("ide", ide.String()).WithError(err).Warn("IDE was stopped")

			ideWasReady, _ := ideReady.Get()
			if !ideWasReady {
				log.WithField("ide", ide.String()).WithError(err).Fatal("IDE failed to start")
				return
			}
		}

		ideReady.Set(false, nil)
		close(ideStopped)
	}()
}

func prepareIDELaunch(cfg *Config, ideConfig *IDEConfig, childProcEnvvars []string) *exec.Cmd {
	args := ideConfig.EntrypointArgs

	// Add default args for IDE (not desktop IDE) to be backwards compatible
	if ideConfig.Entrypoint == "/ide/startup.sh" && len(args) == 0 {
		args = append(args, "--port", "{IDEPORT}")
	}

	for i := range args {
		args[i] = strings.ReplaceAll(args[i], "{IDEPORT}", strconv.Itoa(cfg.IDEPort))
		args[i] = strings.ReplaceAll(args[i], "{DESKTOPIDEPORT}", strconv.Itoa(desktopIDEPort))
	}
	log.WithField("args", args).WithField("entrypoint", ideConfig.Entrypoint).Info("preparing IDE launch")

	cmd := exec.Command(ideConfig.Entrypoint, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		// We need the child process to run in its own process group, s.t. we can suspend and resume
		// IDE and its children.
		Setpgid:   true,
		Pdeathsig: syscall.SIGKILL,

		// All supervisor children run as gitpod user. The environment variables we produce are also
		// gitpod user specific.
		Credential: &syscall.Credential{
			Uid: gitpodUID,
			Gid: gitpodGID,
		},
	}
	cmd.Env = childProcEnvvars

	// Here we must resist the temptation to "neaten up" the IDE output for headless builds.
	// This would break the JSON parsing of the headless builds.
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if lrr := cfg.IDELogRateLimit(ideConfig); lrr > 0 {
		limit := int64(lrr)
		cmd.Stdout = dropwriter.Writer(cmd.Stdout, dropwriter.NewBucket(limit*1024*3, limit*1024))
		cmd.Stderr = dropwriter.Writer(cmd.Stderr, dropwriter.NewBucket(limit*1024*3, limit*1024))
		log.WithField("limit_kb_per_sec", limit).Info("rate limiting IDE log output")
	}

	return cmd
}

// buildChildProcEnv computes the environment variables passed to a child process, based on the total list
// of envvars. If envvars is nil, os.Environ() is used.
//
// Beware: if config contains an OTS URL the results may differ on subsequent calls.
func buildChildProcEnv(cfg *Config, envvars []string) []string {
	if envvars == nil {
		envvars = os.Environ()
	}

	envs := make(map[string]string)
	for _, e := range envvars {
		segs := strings.SplitN(e, "=", 2)
		if len(segs) < 2 {
			log.Printf("\"%s\" has invalid format, not including in IDE environment", e)
			continue
		}
		nme, val := segs[0], segs[1]

		if isBlacklistedEnvvar(nme) {
			continue
		}

		envs[nme] = val
	}
	envs["SUPERVISOR_ADDR"] = fmt.Sprintf("localhost:%d", cfg.APIEndpointPort)

	if cfg.EnvvarOTS != "" {
		es, err := downloadEnvvarOTS(cfg.EnvvarOTS)
		if err != nil {
			log.WithError(err).Warn("unable to download environment variables from OTS")
		}
		for k, v := range es {
			if isBlacklistedEnvvar(k) {
				continue
			}

			envs[k] = v
		}
	}

	// We're forcing basic environment variables here, because supervisor acts like a login process at this point.
	// The gitpod user might not have existed when supervisor was started, hence the HOME coming
	// from the container runtime is probably wrong ("/" to be exact).
	//
	// Wait, how does this env var stuff work on Linux?
	//   First, the kernel does not care or set environment variables, it's all userland.
	//   It's the login process (e.g. /bin/login called by e.g. getty) that sets conventional
	//   environment variables such as HOME and sometimes PATH or TERM.
	//
	// Where can I read up on this, e.g. how others do it?
	//   BusyBox is a good place to start, because it's small enough to be easy to understand.
	//   Start here:
	//     - https://github.com/mirror/busybox/blob/24198f652f10dca5603df7c704263358ca21f5ce/libbb/setup_environment.c#L32
	//     - https://github.com/mirror/busybox/blob/24198f652f10dca5603df7c704263358ca21f5ce/libbb/login.c#L140-L170
	//
	envs["HOME"] = "/home/gitpod"
	envs["USER"] = "gitpod"

	// Particular Java optimisation: Java pre v10 did not gauge it's available memory correctly, and needed explicitly setting "-Xmx" for all Hotspot/openJDK VMs
	if mem, ok := envs["GITPOD_MEMORY"]; ok {
		envs["JAVA_TOOL_OPTIONS"] += fmt.Sprintf(" -Xmx%sm", mem)
	}

	var env, envn []string
	for nme, val := range envs {
		log.WithField("envvar", nme).Debug("passing environment variable to IDE")
		env = append(env, fmt.Sprintf("%s=%s", nme, val))
		envn = append(envn, nme)
	}

	log.WithField("envvar", envn).Debug("passing environment variables to IDE")

	return env
}

func downloadEnvvarOTS(url string) (res map[string]string, err error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	var dl []struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	}
	err = json.NewDecoder(resp.Body).Decode(&dl)
	if err != nil {
		return nil, err
	}

	res = make(map[string]string)
	for _, e := range dl {
		res[e.Name] = e.Value
	}
	return res, nil
}

func runIDEReadinessProbe(cfg *Config, ideConfig *IDEConfig, ide IDEKind) (desktopIDEStatus *DesktopIDEStatus) {
	defer log.WithField("ide", ide.String()).Info("IDE is ready")

	defaultIfEmpty := func(value, defaultValue string) string {
		if len(value) == 0 {
			return defaultValue
		}
		return value
	}

	defaultIfZero := func(value, defaultValue int) int {
		if value == 0 {
			return defaultValue
		}
		return value
	}

	defaultProbePort := cfg.IDEPort
	if ide == DesktopIDE {
		defaultProbePort = desktopIDEPort
	}
	switch ideConfig.ReadinessProbe.Type {
	case ReadinessProcessProbe:
		return

	case ReadinessHTTPProbe:
		var (
			schema = defaultIfEmpty(ideConfig.ReadinessProbe.HTTPProbe.Schema, "http")
			host   = defaultIfEmpty(ideConfig.ReadinessProbe.HTTPProbe.Host, "localhost")
			port   = defaultIfZero(ideConfig.ReadinessProbe.HTTPProbe.Port, defaultProbePort)
			url    = fmt.Sprintf("%s://%s:%d/%s", schema, host, port, strings.TrimPrefix(ideConfig.ReadinessProbe.HTTPProbe.Path, "/"))
			client = http.Client{Timeout: 1 * time.Second}
			tick   = time.NewTicker(500 * time.Millisecond)
		)
		defer tick.Stop()

		t0 := time.Now()

		for {
			<-tick.C

			resp, err := client.Get(url)
			if err != nil {
				continue
			}
			defer resp.Body.Close()

			if resp.StatusCode == http.StatusOK {
				log.WithField("ide", ide.String()).WithField("status", resp.StatusCode).Infof("IDE readiness took %.3f seconds", time.Since(t0).Seconds())

				if ide == DesktopIDE {
					bodyBytes, err := ioutil.ReadAll(resp.Body)
					log.WithField("ide", ide.String()).Infof("IDE status probe body: %s", string(bodyBytes))
					if err != nil {
						log.WithField("ide", ide.String()).WithError(err).Infof("Error reading response body from IDE status probe.")
						break
					}
					err = json.Unmarshal(bodyBytes, &desktopIDEStatus)
					if err != nil {
						log.WithField("ide", ide.String()).WithError(err).WithField("body", bodyBytes).Debugf("Error parsing JSON body from IDE status probe.")
						break
					}
					log.WithField("ide", ide.String()).Infof("Desktop IDE status: %s", desktopIDEStatus)
				}
				break
			}

			log.WithField("ide", ide.String()).WithField("status", resp.StatusCode).Info("IDE readiness probe came back with non-200 status code")
		}
	}
	return
}

func isBlacklistedEnvvar(name string) bool {
	// exclude blacklisted
	prefixBlacklist := []string{
		"THEIA_SUPERVISOR_",
		"GITPOD_TOKENS",
		// The following vars are meant to filter out the kubernetes-injected env vars that we do not know how to turn of (yet)
		"KUBERNETES_SERVICE",
		"KUBERNETES_PORT",
		// This is a magic env var is set to /theia/supervisor. We do not want to point users at it.
		"   ", // 3 spaces
	}
	for _, wep := range prefixBlacklist {
		if strings.HasPrefix(name, wep) {
			return true
		}
	}

	return false
}

func startAPIEndpoint(ctx context.Context, cfg *Config, wg *sync.WaitGroup, services []RegisterableService, tunneled *ports.TunneledPortsService, opts ...grpc.ServerOption) {
	defer wg.Done()
	defer log.Debug("startAPIEndpoint shutdown")

	l, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.APIEndpointPort))
	if err != nil {
		log.WithError(err).Fatal("cannot start health endpoint")
	}

	if cfg.DebugEnable {
		opts = append(opts,
			grpc.UnaryInterceptor(grpc_logrus.UnaryServerInterceptor(log.Log)),
			grpc.StreamInterceptor(grpc_logrus.StreamServerInterceptor(log.Log)),
		)
	}

	m := cmux.New(l)
	restMux := grpcruntime.NewServeMux()
	grpcMux := m.MatchWithWriters(cmux.HTTP2MatchHeaderFieldSendSettings("content-type", "application/grpc"))
	grpcServer := grpc.NewServer(opts...)
	grpcEndpoint := fmt.Sprintf("localhost:%d", cfg.APIEndpointPort)
	for _, reg := range services {
		if reg, ok := reg.(RegisterableGRPCService); ok {
			reg.RegisterGRPC(grpcServer)
		}
		if reg, ok := reg.(RegisterableRESTService); ok {
			err := reg.RegisterREST(restMux, grpcEndpoint)
			if err != nil {
				log.WithError(err).Fatal("cannot register REST service")
			}
		}
	}
	go grpcServer.Serve(grpcMux)

	httpMux := m.Match(cmux.HTTP1Fast())
	routes := http.NewServeMux()
	grpcWebServer := grpcweb.WrapServer(grpcServer, grpcweb.WithWebsockets(true), grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool {
		return true
	}))
	routes.Handle("/_supervisor/v1/", http.StripPrefix("/_supervisor", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.Header.Get("Content-Type"), "application/grpc") ||
			websocket.IsWebSocketUpgrade(r) {
			http.StripPrefix("/v1", grpcWebServer).ServeHTTP(w, r)
		} else {
			restMux.ServeHTTP(w, r)
		}
	})))
	upgrader := websocket.Upgrader{}
	routes.Handle("/_supervisor/tunnel", http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		wsConn, err := upgrader.Upgrade(rw, r, nil)
		if err != nil {
			log.WithError(err).Error("tunnel: upgrade to the WebSocket protocol failed")
			return
		}
		conn, err := gitpod.NewWebsocketConnection(ctx, wsConn, func(staleErr error) {
			log.WithError(staleErr).Error("tunnel: closing stale connection")
		})
		if err != nil {
			log.WithError(err).Error("tunnel: upgrade to the WebSocket protocol failed")
			return
		}
		tunnelOverWebSocket(tunneled, conn)
	}))
	routes.Handle("/_supervisor/frontend", http.FileServer(http.Dir(cfg.FrontendLocation)))
	if cfg.DebugEnable {
		routes.Handle("/_supervisor/debug/tunnels", http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.Header().Set("X-Content-Type-Options", "nosniff")
			rw.Header().Set("Content-Type", "text/plain; charset=utf-8")
			tunneled.Snapshot(rw)
		}))
		routes.Handle("/_supervisor"+pprof.Path, http.StripPrefix("/_supervisor", pprof.Handler()))
	}
	go http.Serve(httpMux, routes)

	go m.Serve()

	<-ctx.Done()
	log.Info("shutting down API endpoint")
	l.Close()
}

func tunnelOverWebSocket(tunneled *ports.TunneledPortsService, conn *gitpod.WebsocketConnection) {
	hostKey, err := generateHostKey()
	if err != nil {
		log.WithError(err).Error("tunnel: failed to generate host key")
		conn.Close()
		return
	}
	config := &ssh.ServerConfig{
		NoClientAuth: true,
	}
	config.AddHostKey(hostKey)
	sshConn, chans, reqs, err := ssh.NewServerConn(conn, config)
	if err != nil {
		log.WithError(err).Error("tunnel: ssh connection handshake failed")
		return
	}
	go func() {
		_ = conn.Wait()
		sshConn.Close()
	}()
	go ssh.DiscardRequests(reqs)
	go func() {
		for ch := range chans {
			go tunnelOverSSH(conn.Ctx, tunneled, ch)
		}
	}()
	err = sshConn.Wait()
	if err != nil {
		log.WithError(err).Error("tunnel: ssh connection failed")
	}
}

func generateHostKey() (ssh.Signer, error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	return ssh.NewSignerFromKey(key)
}

func tunnelOverSSH(ctx context.Context, tunneled *ports.TunneledPortsService, newCh ssh.NewChannel) {
	tunnelReq := &api.TunnelPortRequest{}
	err := proto.Unmarshal(newCh.ExtraData(), tunnelReq)
	if err != nil {
		log.WithError(err).Error("tunnel: invalid ssh chan request")
		_ = newCh.Reject(ssh.Prohibited, err.Error())
		return
	}

	tunnel, err := tunneled.EstablishTunnel(ctx, tunnelReq.ClientId, tunnelReq.Port, tunnelReq.TargetPort)
	if err != nil {
		log.WithError(err).Error("tunnel: failed to establish")
		_ = newCh.Reject(ssh.Prohibited, err.Error())
		return
	}
	log.Debug("tunnel: accepted new connection")
	defer log.Debug("tunnel: connection closed")
	defer tunnel.Close()

	sshChan, reqs, err := newCh.Accept()
	if err != nil {
		log.WithError(err).Error("tunnel: accepting ssh channel failed")
		return
	}
	defer sshChan.Close()
	go ssh.DiscardRequests(reqs)
	ctx, cancel := context.WithCancel(ctx)
	go func() {
		_, _ = io.Copy(sshChan, tunnel)
		cancel()
	}()
	go func() {
		_, _ = io.Copy(tunnel, sshChan)
		cancel()
	}()
	<-ctx.Done()
}

func stopWhenTasksAreDone(ctx context.Context, wg *sync.WaitGroup, shutdown chan ShutdownReason, successChan <-chan taskSuccess) {
	defer wg.Done()
	defer close(shutdown)

	success := <-successChan
	if success.Failed() {
		// we signal task failure via kubernetes termination log
		msg := []byte("headless task failed: " + string(success))
		err := ioutil.WriteFile("/dev/termination-log", msg, 0o644)
		if err != nil {
			log.WithError(err).Error("err while writing termination log")
		}
	}
	shutdown <- ShutdownReasonSuccess
}

func startSSHServer(ctx context.Context, cfg *Config, wg *sync.WaitGroup, childProcEnvvars []string) {
	defer wg.Done()

	if cfg.isHeadless() {
		return
	}

	go func() {
		ssh, err := newSSHServer(ctx, cfg, childProcEnvvars)
		if err != nil {
			log.WithError(err).Error("err creating SSH server")
			return
		}

		err = ssh.listenAndServe()
		if err != nil {
			log.WithError(err).Error("err starting SSH server")
		}
	}()
}

func startContentInit(ctx context.Context, cfg *Config, wg *sync.WaitGroup, cst ContentState) {
	defer wg.Done()
	defer log.Info("supervisor: workspace content available")

	var err error
	defer func() {
		if err == nil {
			return
		}

		ferr := os.WriteFile("/dev/termination-log", []byte(err.Error()), 0o644)
		if ferr != nil {
			log.WithError(err).Error("cannot write termination log")
		}

		log.WithError(err).Fatal("content initialization failed")
	}()

	fn := "/workspace/.gitpod/content.json"
	f, err := os.Open(fn)
	if os.IsNotExist(err) {
		log.WithError(err).Info("no content init descriptor found - not trying to run it")

		// If there is no content descriptor the content must have come from somewhere (i.e. a layer or ws-daemon).
		// Let's wait for that to happen.
		// TODO: rewrite using fsnotify
		t := time.NewTicker(100 * time.Millisecond)
		for range t.C {
			b, err := os.ReadFile("/workspace/.gitpod/ready")
			if err != nil {
				if !os.IsNotExist(err) {
					log.WithError(err).Error("cannot read content ready file")
				}
				continue
			}

			var m csapi.WorkspaceReadyMessage
			err = json.Unmarshal(b, &m)
			if err != nil {
				log.WithError(err).Fatal("cannot unmarshal content ready file")
				continue
			}

			log.WithField("source", m.Source).Info("supervisor: workspace content available")
			cst.MarkContentReady(m.Source)
			t.Stop()
			break
		}

		err = nil
		return
	}
	if err != nil {
		log.WithError(err).Error("cannot open init descriptor")
		return
	}

	src, err := executor.Execute(ctx, "/workspace", f, true)
	if err != nil {
		return
	}

	err = os.Remove(fn)
	if os.IsNotExist(err) {
		// file is gone - we're good
		err = nil
	}
	if err != nil {
		return
	}

	log.WithField("source", src).Info("supervisor: workspace content init finished")
	cst.MarkContentReady(src)
}

func terminateChildProcesses() {
	parent := os.Getpid()

	children, err := processesWithParent(parent)
	if err != nil {
		log.WithError(err).WithField("pid", parent).Warn("cannot find children processes")
		return
	}

	for pid, uid := range children {
		privileged := false
		if initializer.GitpodUID != uid {
			privileged = true
		}

		terminateProcess(pid, privileged)
	}
}

func terminateProcess(pid int, privileged bool) {
	var err error
	if privileged {
		cmd := exec.Command("kill", "-SIGTERM", fmt.Sprintf("%v", pid))
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err = cmd.Run()
	} else {
		err = syscall.Kill(pid, unix.SIGTERM)
	}

	if err != nil {
		log.WithError(err).WithField("pid", pid).Debug("child process is already terminated")
		return
	}

	log.WithField("pid", pid).Debug("SIGTERM'ed child process")
}

func processesWithParent(ppid int) (map[int]int, error) {
	procs, err := procfs.AllProcs()
	if err != nil {
		return nil, err
	}

	children := make(map[int]int)
	for _, proc := range procs {
		stat, err := proc.Stat()
		if err != nil {
			continue
		}

		if stat.PPID != ppid {
			continue
		}

		status, err := proc.NewStatus()
		if err != nil {
			continue
		}

		uid, err := strconv.Atoi(status.UIDs[0])
		if err != nil {
			continue
		}

		children[proc.PID] = uid
	}

	return children, nil
}

func socketActivationForDocker(ctx context.Context, wg *sync.WaitGroup, term *terminal.Mux) {
	defer wg.Done()

	fn := "/var/run/docker.sock"
	l, err := net.Listen("unix", fn)
	if err != nil {
		log.WithError(err).Error("cannot provide Docker activation socket")
		return
	}

	go func() {
		<-ctx.Done()
		l.Close()
	}()

	_ = os.Chown(fn, gitpodUID, gitpodGID)
	for ctx.Err() == nil {
		err = activation.Listen(ctx, l, func(socketFD *os.File) error {
			defer socketFD.Close()
			cmd := exec.Command("/usr/bin/docker-up")
			cmd.Env = append(os.Environ(), "LISTEN_FDS=1")
			cmd.ExtraFiles = []*os.File{socketFD}
			alias, err := term.Start(cmd, terminal.TermOptions{
				Annotations: map[string]string{
					"gitpod.supervisor": "true",
				},
				LogToStdout: true,
			})
			if err != nil {
				return err
			}
			pty, ok := term.Get(alias)
			if !ok {
				return errors.New("cannot find pty")
			}
			ptyCtx, cancel := context.WithCancel(context.Background())
			go func(ptyCtx context.Context) {
				select {
				case <-ctx.Done():
					_ = pty.Command.Process.Signal(syscall.SIGTERM)
				case <-ptyCtx.Done():
				}
			}(ptyCtx)
			_, err = pty.Wait()
			cancel()
			return err
		})
		if err != nil && !errors.Is(err, context.Canceled) {
			log.WithError(err).Error("cannot provide Docker activation socket")
		}
	}
}

func analyseConfigChanges(ctx context.Context, wscfg *Config, w analytics.Writer, cfgobs config.ConfigInterface) {
	cfgc := cfgobs.Observe(ctx)
	var (
		cfg     *gitpod.GitpodConfig
		t       = time.NewTicker(10 * time.Second)
		changes []string
	)
	defer t.Stop()

	computeHash := func(i interface{}) (string, error) {
		b, err := json.Marshal(i)
		if err != nil {
			return "", err
		}
		h := sha256.New()
		_, err = h.Write(b)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%x", h.Sum(nil)), nil
	}

	for {
		select {
		case c, ok := <-cfgc:
			if !ok {
				return
			}
			if cfg == nil {
				cfg = c
				continue
			}

			pch := []struct {
				Name string
				G    func(*gitpod.GitpodConfig) interface{}
			}{
				{"ports", func(gc *gitpod.GitpodConfig) interface{} {
					if gc == nil {
						return nil
					}
					return gc.Ports
				}},
				{"tasks", func(gc *gitpod.GitpodConfig) interface{} {
					if gc == nil {
						return nil
					}
					return gc.Tasks
				}},
				{"prebuild", func(gc *gitpod.GitpodConfig) interface{} {
					if gc == nil || gc.Github == nil {
						return nil
					}
					return gc.Github.Prebuilds
				}},
			}
			for _, ch := range pch {
				prev, _ := computeHash(ch.G(cfg))
				curr, _ := computeHash(ch.G(cfg))
				if prev != curr {
					changes = append(changes, ch.Name)
				}
			}
		case <-t.C:
			if len(changes) == 0 {
				continue
			}
			w.Track(analytics.TrackMessage{
				Identity: analytics.Identity{UserID: wscfg.GitEmail},
				Event:    "config-changed",
				Properties: map[string]interface{}{
					"workspaceId": wscfg.WorkspaceID,
					"changes":     changes,
				},
			})
			changes = nil
		case <-ctx.Done():
			return
		}
	}
}

func runAsGitpodUser(cmd *exec.Cmd) *exec.Cmd {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	if cmd.SysProcAttr.Credential == nil {
		cmd.SysProcAttr.Credential = &syscall.Credential{}
	}
	cmd.SysProcAttr.Credential.Uid = gitpodUID
	cmd.SysProcAttr.Credential.Gid = gitpodGID
	return cmd
}

func handleExit(ec *int) {
	exitCode := *ec
	log.WithField("exitCode", exitCode).Debug("supervisor exit")
	os.Exit(exitCode)
}
