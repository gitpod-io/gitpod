// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"math"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	grpc_recovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	grpcruntime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/prometheus/common/route"
	"github.com/soheilhy/cmux"
	"golang.org/x/crypto/ssh"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/executor"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/config"
	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"
	"github.com/gitpod-io/gitpod/supervisor/pkg/metrics"
	"github.com/gitpod-io/gitpod/supervisor/pkg/ports"
	"github.com/gitpod-io/gitpod/supervisor/pkg/serverapi"
	"github.com/gitpod-io/gitpod/supervisor/pkg/terminal"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/pushgateway/handler"
	"github.com/prometheus/pushgateway/storage"
)

const (
	gitpodUID       = 33333
	gitpodUserName  = "gitpod"
	gitpodGID       = 33333
	gitpodGroupName = "gitpod"
	desktopIDEPort  = 24000
	debugProxyPort  = 23003
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
	Args  []string
	RunGP bool
}

// RunOption customizes the run behaviour.
type RunOption func(*runOptions)

// WithArgs sets the arguments passed to Run.
func WithArgs(args []string) RunOption {
	return func(r *runOptions) {
		r.Args = args
	}
}

// WithRunGP disables some functionality for use with run-gp
func WithRunGP(enable bool) RunOption {
	return func(r *runOptions) {
		r.RunGP = enable
	}
}

// The sum of those timeBudget* times has to fit within the terminationGracePeriod of the workspace pod.
const (
	timeBudgetIDEShutdown = 15 * time.Second
)

const (
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
		return "web"
	case DesktopIDE:
		return "desktop"
	}
	return "unknown"
}

var childProcEnvvars []string

// Run serves as main entrypoint to the supervisor.
func Run(options ...RunOption) {
	exitCode := 0
	defer handleExit(&exitCode)
	defer func() {
		r := recover()
		if r == nil {
			return
		}
		log.WithField("cause", r).WithField("stack", string(debug.Stack())).Error("panicked")
		if exitCode == 0 {
			exitCode = 1
		}
	}()

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
	childProcEnvvars = buildChildProcEnv(cfg, nil, opts.RunGP)

	err = AddGitpodUserIfNotExists()
	if err != nil {
		log.WithError(err).Fatal("cannot ensure Gitpod user exists")
	}
	symlinkBinaries(cfg)

	configureGit(cfg)

	telemetry := analytics.NewFromEnvironment()
	defer telemetry.Close()

	tokenService := NewInMemoryTokenService()

	if !opts.RunGP {
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
	}

	tunneledPortsService := ports.NewTunneledPortsService(cfg.DebugEnable)
	_, err = tunneledPortsService.Tunnel(context.Background(),
		&ports.TunnelOptions{
			SkipIfExists: false,
		},
		&ports.PortTunnelDescription{
			LocalPort:  uint32(cfg.APIEndpointPort),
			TargetPort: uint32(cfg.APIEndpointPort),
			Visibility: api.TunnelVisiblity_host,
		},
		&ports.PortTunnelDescription{
			LocalPort:  uint32(cfg.SSHPort),
			TargetPort: uint32(cfg.SSHPort),
			Visibility: api.TunnelVisiblity_host,
		},
	)
	if err != nil {
		log.WithError(err).Warn("cannot tunnel internal ports")
	}

	ctx, cancel := context.WithCancel(context.Background())

	internalPorts := []uint32{uint32(cfg.IDEPort), uint32(cfg.APIEndpointPort), uint32(cfg.SSHPort)}
	if cfg.GetDesktopIDE() != nil {
		internalPorts = append(internalPorts, desktopIDEPort)
	}
	if cfg.isDebugWorkspace() {
		internalPorts = append(internalPorts, debugProxyPort)
	}

	endpoint, host, err := cfg.GitpodAPIEndpoint()
	if err != nil {
		log.WithError(err).Fatal("cannot find Gitpod API endpoint")
	}

	experimentsClientOpts := []experiments.ClientOpt{}
	if cfg.ConfigcatEnabled {
		experimentsClientOpts = append(experimentsClientOpts, experiments.WithGitpodProxy(host))
	}
	exps := experiments.NewClient(experimentsClientOpts...)

	var (
		ideReady                       = &ideReadyState{cond: sync.NewCond(&sync.Mutex{})}
		desktopIdeReady *ideReadyState = nil

		cstate        = NewInMemoryContentState(cfg.RepoRoot)
		gitpodService serverapi.APIInterface

		notificationService = NewNotificationService()
	)

	if !opts.RunGP {
		gitpodService = serverapi.NewServerApiService(ctx, &serverapi.ServiceConfig{
			Host:              host,
			Endpoint:          endpoint,
			InstanceID:        cfg.WorkspaceInstanceID,
			WorkspaceID:       cfg.WorkspaceID,
			OwnerID:           cfg.OwnerId,
			SupervisorVersion: Version,
			ConfigcatEnabled:  cfg.ConfigcatEnabled,
		}, tokenService, exps)
	}

	if cfg.GetDesktopIDE() != nil {
		desktopIdeReady = &ideReadyState{cond: sync.NewCond(&sync.Mutex{})}
	}
	if !cfg.isHeadless() && !opts.RunGP && !cfg.isDebugWorkspace() {
		go trackReadiness(ctx, telemetry, cfg, cstate, ideReady, desktopIdeReady)
	}
	tokenService.provider[KindGit] = []tokenProvider{NewGitTokenProvider(gitpodService, cfg.WorkspaceConfig, notificationService)}

	gitpodConfigService := config.NewConfigService(cfg.RepoRoot+"/.gitpod.yml", cstate.ContentReady())
	go gitpodConfigService.Watch(ctx)

	var exposedPorts ports.ExposedPortsInterface

	if !opts.RunGP {
		exposedPorts = createExposedPortsImpl(cfg, gitpodService)
	}

	portMgmt := ports.NewManager(
		exposedPorts,
		&ports.PollingServedPortsObserver{
			RefreshInterval: 2 * time.Second,
		},
		ports.NewConfigService(cfg.WorkspaceID, gitpodConfigService),
		tunneledPortsService,
		internalPorts...,
	)

	topService := NewTopService()
	if !opts.RunGP {
		topService.Observe(ctx)
	}

	if !cfg.isHeadless() && !opts.RunGP {
		go analyseConfigChanges(ctx, cfg, telemetry, gitpodConfigService)
		go analysePerfChanges(ctx, cfg, telemetry, topService)
	}

	supervisorMetrics := metrics.NewMetrics()
	var metricsReporter *metrics.GrpcMetricsReporter
	if !opts.RunGP && !cfg.isDebugWorkspace() && !strings.Contains("ephemeral", cfg.WorkspaceClusterHost) {
		_, gitpodHost, err := cfg.GitpodAPIEndpoint()
		if err != nil {
			log.WithError(err).Error("grpc metrics: failed to parse gitpod host")
		} else {
			metricsReporter = metrics.NewGrpcMetricsReporter(gitpodHost)
			if err := supervisorMetrics.Register(metricsReporter.Registry); err != nil {
				log.WithError(err).Error("could not register supervisor metrics")
			}
			if err := gitpodService.RegisterMetrics(metricsReporter.Registry); err != nil {
				log.WithError(err).Error("could not register public api metrics")
			}
		}
	}

	termMux := terminal.NewMux()
	termMuxSrv := terminal.NewMuxTerminalService(termMux)
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

	taskManager := newTasksManager(cfg, termMuxSrv, cstate, nil, ideReady, desktopIdeReady)

	gitStatusWg := &sync.WaitGroup{}
	gitStatusCtx, stopGitStatus := context.WithCancel(ctx)
	if !cfg.isPrebuild() && !cfg.isHeadless() && !opts.RunGP && !cfg.isDebugWorkspace() {
		gitStatusWg.Add(1)
		gitStatusService := &GitStatusService{
			cfg:           cfg,
			experiments:   exps,
			content:       cstate,
			git:           &git.Client{Location: cfg.RepoRoot},
			gitpodService: gitpodService,
		}
		go gitStatusService.Run(gitStatusCtx, gitStatusWg)
	}

	willShutdownCtx, fireWillShutdown := context.WithCancel(ctx)
	apiServices := []RegisterableService{
		&statusService{
			willShutdownCtx: willShutdownCtx,
			ContentState:    cstate,
			Ports:           portMgmt,
			Tasks:           taskManager,
			ideReady:        ideReady,
			desktopIdeReady: desktopIdeReady,
			topService:      topService,
		},
		termMuxSrv,
		RegistrableTokenService{Service: tokenService},
		notificationService,
		&InfoService{cfg: cfg, ContentState: cstate},
		&ControlService{portsManager: portMgmt},
		&portService{portsManager: portMgmt},
	}
	apiServices = append(apiServices, additionalServices...)

	if !cfg.isPrebuild() {
		// We need to checkout dotfiles first, because they may be changing the path which affects the IDE.
		// TODO(cw): provide better feedback if the IDE start fails because of the dotfiles (provide any feedback at all).
		installDotfiles(ctx, cfg, tokenService)
	}

	var ideWG sync.WaitGroup
	ideWG.Add(1)
	go startAndWatchIDE(ctx, cfg, &cfg.IDE, &ideWG, cstate, ideReady, WebIDE, supervisorMetrics)
	if cfg.GetDesktopIDE() != nil {
		ideWG.Add(1)
		go startAndWatchIDE(ctx, cfg, cfg.GetDesktopIDE(), &ideWG, cstate, desktopIdeReady, DesktopIDE, supervisorMetrics)
	}

	var (
		wg       sync.WaitGroup
		shutdown = make(chan ShutdownReason, 1)
	)

	if opts.RunGP {
		cstate.MarkContentReady(csapi.WorkspaceInitFromOther)
	} else if cfg.isDebugWorkspace() {
		cstate.MarkContentReady(cfg.GetDebugWorkspaceContentSource())
	} else {
		wg.Add(1)
		go startContentInit(ctx, cfg, &wg, cstate, supervisorMetrics)
	}

	wg.Add(1)
	go startAPIEndpoint(ctx, cfg, &wg, apiServices, tunneledPortsService, metricsReporter, apiEndpointOpts...)

	wg.Add(1)
	go startSSHServer(ctx, cfg, &wg)

	wg.Add(1)
	tasksSuccessChan := make(chan taskSuccess, 1)
	go taskManager.Run(ctx, &wg, tasksSuccessChan)

	if !opts.RunGP {
		wg.Add(1)
		go socketActivationForDocker(ctx, &wg, termMux, cfg, telemetry, notificationService, cstate)
	}

	if cfg.isHeadless() {
		wg.Add(1)
		go stopWhenTasksAreDone(ctx, &wg, shutdown, tasksSuccessChan)
	} else if !opts.RunGP {
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

	if !cfg.isPrebuild() && !opts.RunGP && !cfg.isDebugWorkspace() {
		go func() {
			for _, repoRoot := range strings.Split(cfg.RepoRoots, ",") {
				<-cstate.ContentReady()
				waitForIde(ctx, ideReady, desktopIdeReady, 1*time.Second)

				start := time.Now()
				defer func() {
					log.Debugf("unshallow of local repository took %v", time.Since(start))
				}()

				if !isShallowRepository(repoRoot) {
					return
				}

				cmd := runAsGitpodUser(exec.Command("git", "fetch", "--unshallow", "--tags"))
				cmd.Dir = repoRoot
				cmd.Stdout = os.Stdout
				cmd.Stderr = os.Stderr
				err := cmd.Run()
				if err != nil {
					log.WithError(err).Error("git fetch error")
				}
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
	fireWillShutdown()

	// wait for last git status to persist
	stopGitStatus()
	gitStatusWg.Wait()

	terminalShutdownCtx, cancelTermination := context.WithTimeout(context.Background(), cfg.GetTerminationGracePeriod())
	defer cancelTermination()
	cancel()
	ideWG.Wait()
	// terminate all terminal processes once the IDE is gone
	termMux.Close(terminalShutdownCtx)

	wg.Wait()
}

func isShallowRepository(rootDir string) bool {
	cmd := runAsGitpodUser(exec.Command("git", "rev-parse", "--is-shallow-repository"))
	cmd.Dir = rootDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.WithError(err).Error("unexpected error checking if git repository is shallow")
		return true
	}

	isShallow, err := strconv.ParseBool(strings.TrimSpace(string(out)))
	if err != nil {
		log.WithError(err).WithField("input", string(out)).Error("unexpected error parsing bool")
		return true
	}

	return isShallow
}

func installDotfiles(ctx context.Context, cfg *Config, tokenService *InMemoryTokenService) {
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
		runAsGitpodUser(cmd)
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

func createExposedPortsImpl(cfg *Config, gitpodService serverapi.APIInterface) ports.ExposedPortsInterface {
	if gitpodService == nil {
		log.Error("auto-port exposure won't work")
		return &ports.NoopExposedPorts{}
	}
	return ports.NewGitpodExposedPorts(cfg.WorkspaceID, cfg.WorkspaceInstanceID, cfg.WorkspaceUrl, gitpodService)
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

func configureGit(cfg *Config) {
	settings := [][]string{
		{"push.default", "simple"},
		{"alias.lg", "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"},
		{"credential.helper", "/usr/bin/gp credential-helper"},
		{"safe.directory", "*"},
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

var (
	errSignalTerminated = errors.New("signal: terminated")
)

func startAndWatchIDE(ctx context.Context, cfg *Config, ideConfig *IDEConfig, wg *sync.WaitGroup, cstate *InMemoryContentState, ideReady *ideReadyState, ide IDEKind, metrics *metrics.SupervisorMetrics) {
	defer wg.Done()
	defer log.WithField("ide", ide.String()).Debug("startAndWatchIDE shutdown")

	if cfg.isHeadless() {
		ideReady.Set(true, nil)
		return
	}

	// Wait until content ready to launch IDE
	<-cstate.ContentReady()

	ideStatus := statusNeverRan

	var (
		cmd        *exec.Cmd
		ideStopped chan struct{}
		firstStart bool = true
	)
supervisorLoop:
	for {
		if ideStatus == statusShouldShutdown {
			break
		}

		ideStopped = make(chan struct{}, 1)
		startTime := time.Now()
		cmd = prepareIDELaunch(cfg, ideConfig)
		launchIDE(cfg, ideConfig, cmd, ideStopped, ideReady, &ideStatus, ide)

		if firstStart {
			firstStart = false
			go func() {
				select {
				case <-ideReady.Wait():
					cost := time.Since(startTime).Seconds()
					his, err := metrics.IDEReadyDurationTotal.GetMetricWithLabelValues(ide.String())
					if err != nil {
						log.WithError(err).Error("cannot get metrics for IDEReadyDurationTotal")
						return
					}
					his.Observe(cost)
				case <-ctx.Done():
				}
			}()
		}

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
				log.WithField("ide", ide.String()).Error("cmd or cmd.Process is nil, cannot send SIGTERM signal")
			} else {
				_ = cmd.Process.Signal(syscall.SIGTERM)
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

		log.Info("start launchIDE")
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
			if errSignalTerminated.Error() != err.Error() {
				log.WithField("ide", ide.String()).WithError(err).Warn("IDE was stopped")
			}

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

func prepareIDELaunch(cfg *Config, ideConfig *IDEConfig) *exec.Cmd {
	args := ideConfig.EntrypointArgs
	for i := range args {
		args[i] = strings.ReplaceAll(args[i], "{IDEPORT}", strconv.Itoa(cfg.IDEPort))
		args[i] = strings.ReplaceAll(args[i], "{DESKTOPIDEPORT}", strconv.Itoa(desktopIDEPort))
	}
	log.WithField("args", args).WithField("entrypoint", ideConfig.Entrypoint).Info("preparing IDE launch")

	cmd := exec.Command(ideConfig.Entrypoint, args...)

	// All supervisor children run as gitpod user. The environment variables we produce are also
	// gitpod user specific.
	runAsGitpodUser(cmd)

	// We need the child process to run in its own process group, s.t. we can suspend and resume
	// IDE and its children.
	cmd.SysProcAttr.Setpgid = true
	cmd.SysProcAttr.Pdeathsig = syscall.SIGKILL

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
func buildChildProcEnv(cfg *Config, envvars []string, runGP bool) []string {
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

	getEnv := func(name string) string {
		return envs[name]
	}
	for _, ide := range []*IDEConfig{&cfg.IDE, cfg.GetDesktopIDE()} {
		if ide == nil || ide.Env == nil {
			continue
		}
		for _, name := range ide.Env.Keys() {
			if isBlacklistedEnvvar(name) {
				continue
			}
			raw, exists := ide.Env.Get(name)
			if !exists {
				continue
			}
			if value, ok := raw.(string); ok {
				envs[name] = os.Expand(value, getEnv)
			}
		}
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

	if _, ok := envs["HISTFILE"]; !ok {
		envs["HISTFILE"] = "/workspace/.gitpod/.shell_history"
		envs["PROMPT_COMMAND"] = "history -a"
	}

	if _, ok := envs["BROWSER"]; !ok {
		envs["BROWSER"] = "/.supervisor/browser.sh"
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
		)

		t0 := time.Now()

		var body []byte
		for range time.Tick(250 * time.Millisecond) {
			var err error
			body, err = ideStatusRequest(url)
			if err != nil {
				log.WithField("ide", ide.String()).WithError(err).Debug("Error running IDE readiness probe")
				continue
			}

			break
		}

		duration := time.Since(t0).Seconds()
		log.WithField("ide", ide.String()).WithField("duration", duration).Infof("IDE readiness took %.3f seconds", duration)

		if ide != DesktopIDE {
			return
		}

		err := json.Unmarshal(body, &desktopIDEStatus)
		if err != nil {
			log.WithField("ide", ide.String()).WithError(err).WithField("body", body).Debugf("Error parsing JSON body from IDE status probe.")
			return
		}

		log.WithField("ide", ide.String()).Infof("Desktop IDE status: %s", desktopIDEStatus)
		return
	}

	return
}

func ideStatusRequest(url string) ([]byte, error) {
	client := http.Client{Timeout: 1 * time.Second}

	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, xerrors.Errorf("IDE readiness probe came back with non-200 status code (%v)", resp.StatusCode)
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
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

func startAPIEndpoint(ctx context.Context, cfg *Config, wg *sync.WaitGroup, services []RegisterableService, tunneled *ports.TunneledPortsService, metricsReporter *metrics.GrpcMetricsReporter, opts ...grpc.ServerOption) {
	defer wg.Done()
	defer log.Debug("startAPIEndpoint shutdown")

	l, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.APIEndpointPort))
	if err != nil {
		log.WithError(err).Fatal("cannot start health endpoint")
	}

	var unaryInterceptors []grpc.UnaryServerInterceptor
	var streamInterceptors []grpc.StreamServerInterceptor

	if cfg.DebugEnable {
		unaryInterceptors = append(unaryInterceptors, grpc_logrus.UnaryServerInterceptor(log.Log))
		streamInterceptors = append(streamInterceptors, grpc_logrus.StreamServerInterceptor(log.Log))
	}

	if metricsReporter != nil {
		grpcMetrics := grpc_prometheus.NewServerMetrics()
		grpcMetrics.EnableHandlingTimeHistogram(
			// it should be aligned with https://github.com/gitpod-io/gitpod/blob/196a109eee50bfb7da2c6b858a3e78f2a2d0b26f/install/installer/pkg/components/ide-metrics/configmap.go#L199
			grpc_prometheus.WithHistogramBuckets([]float64{.005, .025, .05, .1, .5, 1, 2.5, 5, 30, 60, 120, 240, 600}),
		)
		unaryInterceptors = append(unaryInterceptors, grpcMetrics.UnaryServerInterceptor())
		streamInterceptors = append(streamInterceptors, grpcMetrics.StreamServerInterceptor())

		err = metricsReporter.Registry.Register(grpcMetrics)
		if err != nil {
			log.WithError(err).Error("supervisor: failed to register grpc metrics")
		} else {
			go metricsReporter.Report(ctx)
		}
	}

	// add gprc recover, must be last, to be executed first after the rpc handler, we want upstream interceptors to have a meaningful response to work with)
	unaryInterceptors = append(unaryInterceptors, grpc_recovery.UnaryServerInterceptor(grpc_recovery.WithRecoveryHandlerContext(
		func(ctx context.Context, p interface{}) error {
			log.WithField("stack", string(debug.Stack())).Errorf("[PANIC] %s", p)
			return status.Errorf(codes.Internal, "%s", p)
		},
	)))
	streamInterceptors = append(streamInterceptors, grpc_recovery.StreamServerInterceptor(grpc_recovery.WithRecoveryHandlerContext(
		func(ctx context.Context, p interface{}) error {
			log.WithField("stack", string(debug.Stack())).Errorf("[PANIC] %s", p)
			return status.Errorf(codes.Internal, "%s", p)
		},
	)))

	opts = append(opts,
		grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(unaryInterceptors...)),
		grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(streamInterceptors...)),
	)

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

	// TODO(ak) remove it, refactor clients to use IDE proxy
	metricStore := storage.NewDiskMetricStore("", time.Minute*5, prometheus.DefaultGatherer, nil)
	metricsGatherer := prometheus.Gatherers{prometheus.GathererFunc(func() ([]*dto.MetricFamily, error) {
		return metricStore.GetMetricFamilies(), nil
	})}

	metrics := route.New().WithPrefix("/metrics")
	metrics.Put("/job/:job/*labels", handler.Push(metricStore, true, true, false, nil))
	metrics.Post("/job/:job/*labels", handler.Push(metricStore, false, true, false, nil))
	metrics.Del("/job/:job/*labels", handler.Delete(metricStore, false, nil))
	metrics.Put("/job/:job", handler.Push(metricStore, true, true, false, nil))
	metrics.Post("/job/:job", handler.Push(metricStore, false, true, false, nil))
	routes.Handle("/metrics", promhttp.HandlerFor(metricsGatherer, promhttp.HandlerOpts{}))
	routes.Handle("/metrics/", metrics)

	ideURL, _ := url.Parse(fmt.Sprintf("http://localhost:%d", cfg.IDEPort))
	routes.Handle("/", httputil.NewSingleHostReverseProxy(ideURL))
	routes.Handle("/_supervisor/frontend/", http.StripPrefix("/_supervisor/frontend", http.FileServer(http.Dir(cfg.StaticConfig.FrontendLocation))))

	routes.Handle("/_supervisor/v1/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.Header.Get("Content-Type"), "application/grpc") || websocket.IsWebSocketUpgrade(r) {
			http.StripPrefix("/_supervisor/v1", grpcWebServer).ServeHTTP(w, r)
		} else {
			http.StripPrefix("/_supervisor", restMux).ServeHTTP(w, r)
		}
	}))

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
	routes.Handle("/_supervisor/tunnel/ssh", http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		wsConn, err := upgrader.Upgrade(rw, r, nil)
		if err != nil {
			log.WithError(err).Error("tunnel ssh: upgrade to the WebSocket protocol failed")
			return
		}
		conn, err := gitpod.NewWebsocketConnection(ctx, wsConn, func(staleErr error) {
			log.WithError(staleErr).Error("tunnel ssh: closing stale connection")
		})
		if err != nil {
			log.WithError(err).Error("tunnel ssh: upgrade to the WebSocket protocol failed")
			return
		}

		log.Infof("tunnel ssh: Connected from %s", conn.RemoteAddr())

		conn2, err := net.Dial("tcp", net.JoinHostPort("localhost", strconv.FormatInt(int64(cfg.SSHPort), 10)))
		if err != nil {
			log.WithError(err).Error("tunnel ssh: dial to ssh server failed")
			return
		}

		go io.Copy(conn, conn2)
		_, err = io.Copy(conn2, conn)
		if err != nil {
			log.WithError(err).Error("tunnel ssh: error returned from io.copy")
		}

		conn.Close()
		conn2.Close()
		log.Infof("tunnel ssh: Disconnect from %s", conn.RemoteAddr())
	}))
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

func startSSHServer(ctx context.Context, cfg *Config, wg *sync.WaitGroup) {
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
		configureSSHDefaultDir(cfg)
		configureSSHMessageOfTheDay()
		err = ssh.listenAndServe()
		if err != nil {
			log.WithError(err).Error("err starting SSH server")
		}
	}()
}

func startContentInit(ctx context.Context, cfg *Config, wg *sync.WaitGroup, cst ContentState, metrics *metrics.SupervisorMetrics) {
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
	fnReady := "/workspace/.gitpod/ready"

	contentFile, err := os.Open(fn)
	if err != nil {
		if !os.IsNotExist(err) {
			log.WithError(err).Error("cannot open init descriptor")
			return
		}

		log.Infof("%s does not exist, going to wait for %s", fn, fnReady)

		// If there is no content descriptor the content must have come from somewhere (i.e. a layer or ws-daemon).
		// Let's wait for that to happen.
		// TODO: rewrite using fsnotify
		t := time.NewTicker(100 * time.Millisecond)
		for range t.C {
			b, err := os.ReadFile(fnReady)
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

	defer contentFile.Close()

	log.Info("supervisor: running content service executor with content descriptor")
	var src csapi.WorkspaceInitSource
	src, err = executor.Execute(ctx, "/workspace", contentFile, true)
	if err != nil {
		return
	}

	recordInitializerMetrics("/workspace", metrics)

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

func recordInitializerMetrics(path string, metrics *metrics.SupervisorMetrics) {
	readyFile := filepath.Join(path, ".gitpod/ready")

	content, err := os.ReadFile(readyFile)
	if err != nil {
		log.WithError(err).Errorf("could not find ready file at %v", readyFile)
		return
	}

	var ready csapi.WorkspaceReadyMessage
	err = json.Unmarshal(content, &ready)
	if err != nil {
		log.WithError(err).Error("could not unmarshal ready")
		return
	}

	for _, m := range ready.Metrics {
		metrics.InitializerHistogram.WithLabelValues(m.Type).Observe(float64(m.Size) / m.Duration.Seconds())
	}
}

type PerfAnalyzer struct {
	label   string
	defs    []int
	buckets []int
}

func (a *PerfAnalyzer) analyze(used float64) bool {
	var buckets []int
	usedBucket := int(math.Ceil(used))
	for _, bucket := range a.defs {
		if usedBucket >= bucket {
			buckets = append(buckets, bucket)
		}
	}
	if len(buckets) <= len(a.buckets) {
		return false
	}
	a.buckets = buckets
	return true
}

func analysePerfChanges(ctx context.Context, wscfg *Config, w analytics.Writer, topService *TopService) {
	analyze := func(analyzer *PerfAnalyzer, used float64) {
		if !analyzer.analyze(used) {
			return
		}
		if wscfg.isDebugWorkspace() {
			log.WithField("buckets", analyzer.buckets).WithField("used", used).WithField("label", analyzer.label).Info("gitpod perf analytics: changed")
		} else {
			w.Track(analytics.TrackMessage{
				Identity: analytics.Identity{UserID: wscfg.OwnerId},
				Event:    "gitpod_" + analyzer.label + "_changed",
				Properties: map[string]interface{}{
					"used":        used,
					"buckets":     analyzer.buckets,
					"instanceId":  wscfg.WorkspaceInstanceID,
					"workspaceId": wscfg.WorkspaceID,
				},
			})
		}
	}

	cpuAnalyzer := &PerfAnalyzer{label: "cpu", defs: []int{1, 2, 3, 4, 5, 6, 7, 8}}
	memoryAnalyzer := &PerfAnalyzer{label: "memory", defs: []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}}
	ticker := time.NewTicker(1 * time.Second)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			data := topService.data
			if data == nil {
				continue
			}
			analyze(cpuAnalyzer, float64(data.Cpu.Used)/1000)
			analyze(memoryAnalyzer, float64(data.Memory.Used)/(1024*1024*1024))
		}
	}
}

func analyzeImageFileChanges(ctx context.Context, wscfg *Config, w analytics.Writer, cfgobs config.ConfigInterface, debounceDuration time.Duration) {
	var (
		timer *time.Timer
		mu    sync.Mutex
	)
	analyze := func(change *struct{}) {
		mu.Lock()
		defer mu.Unlock()
		if timer != nil && !timer.Stop() {
			<-timer.C
		}
		timer = time.AfterFunc(debounceDuration, func() {
			mu.Lock()
			defer mu.Unlock()
			timer = nil
			msg := analytics.TrackMessage{
				Identity: analytics.Identity{UserID: wscfg.OwnerId},
				Event:    "gitpod_image_file_changed",
				Properties: map[string]interface{}{
					"instanceId":  wscfg.WorkspaceInstanceID,
					"workspaceId": wscfg.WorkspaceID,
					"exists":      change != nil,
				},
			}
			if !wscfg.isDebugWorkspace() {
				w.Track(msg)
			} else {
				log.WithField("msg", msg).Info("gitpod config analytics: image file changed")
			}
		})
	}
	changes := cfgobs.ObserveImageFile(ctx)
	initial := true
	for {
		select {
		case change, ok := <-changes:
			if !ok {
				return
			}
			if initial {
				// only report changes, not initial state
				initial = false
			} else {
				analyze(change)
			}
		case <-ctx.Done():
			return
		}
	}
}

func analyseConfigChanges(ctx context.Context, wscfg *Config, w analytics.Writer, cfgobs config.ConfigInterface) {
	var analyzer *config.ConfigAnalyzer
	log.Debug("gitpod config analytics: watching...")

	debounceDuration := 5 * time.Second
	go analyzeImageFileChanges(ctx, wscfg, w, cfgobs, debounceDuration)

	cfgs := cfgobs.Observe(ctx)
	for {
		select {
		case cfg, ok := <-cfgs:
			if !ok {
				return
			}
			if analyzer != nil {
				analyzer.Analyse(cfg)
			} else {
				analyzer = config.NewConfigAnalyzer(log.Log, debounceDuration, func(field string) {
					msg := analytics.TrackMessage{
						Identity: analytics.Identity{UserID: wscfg.OwnerId},
						Event:    "gitpod_config_changed",
						Properties: map[string]interface{}{
							"key":         field,
							"instanceId":  wscfg.WorkspaceInstanceID,
							"workspaceId": wscfg.WorkspaceID,
						},
					}
					if !wscfg.isDebugWorkspace() {
						w.Track(msg)
					} else {
						log.WithField("msg", msg).Info("gitpod config analytics: config changed")
					}
				}, cfg)
			}

		case <-ctx.Done():
			return
		}
	}
}

func trackReadiness(ctx context.Context, w analytics.Writer, cfg *Config, cstate *InMemoryContentState, ideReady *ideReadyState, desktopIdeReady *ideReadyState) {
	trackFn := func(cfg *Config, kind string) {
		w.Track(analytics.TrackMessage{
			Identity: analytics.Identity{UserID: cfg.OwnerId},
			Event:    "supervisor_readiness",
			Properties: map[string]interface{}{
				"kind":        kind,
				"workspaceId": cfg.WorkspaceID,
				"instanceId":  cfg.WorkspaceInstanceID,
				"timestamp":   time.Now().UnixMilli(),
			},
		})
	}
	const (
		readinessKindContent    = "content"
		readinessKindIDE        = "ide"
		readinessKindDesktopIDE = "ide-desktop"
	)
	go func() {
		<-cstate.ContentReady()
		trackFn(cfg, readinessKindContent)
	}()
	go func() {
		<-ideReady.Wait()
		trackFn(cfg, readinessKindIDE)
	}()
	if cfg.GetDesktopIDE() != nil {
		go func() {
			<-desktopIdeReady.Wait()
			trackFn(cfg, readinessKindDesktopIDE)
		}()
	}
}

func runAsGitpodUser(cmd *exec.Cmd) *exec.Cmd {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	if cmd.SysProcAttr.Credential == nil {
		cmd.SysProcAttr.Credential = &syscall.Credential{}
	}
	cmd.Env = append(cmd.Env, childProcEnvvars...)
	cmd.SysProcAttr.Credential.Uid = gitpodUID
	cmd.SysProcAttr.Credential.Gid = gitpodGID
	return cmd
}

func handleExit(ec *int) {
	exitCode := *ec
	log.WithField("exitCode", exitCode).Debug("supervisor exit")
	os.Exit(exitCode)
}

func waitForIde(parent context.Context, ideReady *ideReadyState, desktopIdeReady *ideReadyState, timeout time.Duration) {
	if ideReady == nil {
		return
	}
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	select {
	case <-ctx.Done():
		return
	case <-ideReady.Wait():
	}

	if desktopIdeReady == nil {
		return
	}
	select {
	case <-ctx.Done():
		return
	case <-desktopIdeReady.Wait():
	}
}
