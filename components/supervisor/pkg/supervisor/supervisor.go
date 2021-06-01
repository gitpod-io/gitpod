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
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
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

	"github.com/golang/protobuf/proto"
	"github.com/gorilla/websocket"
	grpcruntime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/prometheus/procfs"
	"github.com/soheilhy/cmux"
	"golang.org/x/crypto/ssh"
	"golang.org/x/sys/unix"
	"google.golang.org/grpc"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/executor"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/activation"
	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"
	"github.com/gitpod-io/gitpod/supervisor/pkg/ports"
	"github.com/gitpod-io/gitpod/supervisor/pkg/terminal"

	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
)

var (
	additionalServices []RegisterableService
	apiEndpointOpts    []grpc.ServerOption
)

// RegisterAdditionalService registers additional services for the API endpoint
// of supervisor.
func RegisterAdditionalService(services ...RegisterableService) {
	additionalServices = append(additionalServices, services...)
}

// AddAPIEndpointOpts adds additional grpc server options for the API endpoint
func AddAPIEndpointOpts(opts ...grpc.ServerOption) {
	apiEndpointOpts = append(apiEndpointOpts, opts...)
}

type runOptions struct {
	Args []string
}

// RunOption customizes the run behaviour
type RunOption func(*runOptions)

// WithArgs sets the arguments passed to Run
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
	// KindGitpod marks tokens that provide access to the Gitpod server API
	KindGitpod = "gitpod"

	// KindGit marks any kind of Git access token
	KindGit = "git"
)

// Run serves as main entrypoint to the supervisor
func Run(options ...RunOption) {
	defer log.Info("supervisor shut down")

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

	buildIDEEnv(&Config{})
	configureGit(cfg)

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

	ctx, cancel := context.WithCancel(context.Background())
	var (
		shutdown            = make(chan struct{})
		ideReady            = &ideReadyState{cond: sync.NewCond(&sync.Mutex{})}
		cstate              = NewInMemoryContentState(cfg.RepoRoot)
		gitpodService       = createGitpodService(cfg, tokenService)
		gitpodConfigService = gitpod.NewConfigService(cfg.RepoRoot+"/.gitpod.yml", cstate.ContentReady(), log.Log)
		portMgmt            = ports.NewManager(
			createExposedPortsImpl(cfg, gitpodService),
			&ports.PollingServedPortsObserver{
				RefreshInterval: 2 * time.Second,
			},
			ports.NewConfigService(cfg.WorkspaceID, gitpodConfigService, gitpodService),
			tunneledPortsService,
			uint32(cfg.IDEPort),
			uint32(cfg.APIEndpointPort),
			uint32(cfg.SSHPort),
		)
		termMux             = terminal.NewMux()
		termMuxSrv          = terminal.NewMuxTerminalService(termMux)
		taskManager         = newTasksManager(cfg, termMuxSrv, cstate, &loggingHeadlessTaskProgressReporter{})
		analytics           = analytics.NewFromEnvironment()
		notificationService = NewNotificationService()
	)
	tokenService.provider[KindGit] = []tokenProvider{NewGitTokenProvider(gitpodService, cfg.WorkspaceConfig, notificationService)}

	defer analytics.Close()
	go analyseConfigChanges(ctx, cfg, analytics, gitpodConfigService)

	termMuxSrv.DefaultWorkdir = cfg.RepoRoot
	termMuxSrv.Env = buildIDEEnv(cfg)
	termMuxSrv.DefaultCreds = &syscall.Credential{
		Uid: 33333,
		Gid: 33333,
	}

	apiServices := []RegisterableService{
		&statusService{
			ContentState: cstate,
			Ports:        portMgmt,
			Tasks:        taskManager,
			ideReady:     ideReady,
		},
		termMuxSrv,
		RegistrableTokenService{Service: tokenService},
		notificationService,
		&InfoService{cfg: cfg, ContentState: cstate},
		&ControlService{portsManager: portMgmt},
		&portService{portsManager: portMgmt},
	}
	apiServices = append(apiServices, additionalServices...)

	// The reaper can be turned into a terminating reaper by writing true to this channel.
	// When in terminating mode, the reaper will send SIGTERM to each child that gets reparented
	// to us and is still running. We use this mechanism to send SIGTERM to a shell child processes
	// that get reparented once their parent shell terminates during shutdown.
	terminatingReaper := make(chan bool)
	// We keep the reaper until the bitter end because:
	//   - it doesn't need graceful shutdown
	//   - we want to do as much work as possible (SIGTERM'ing reparented processes during shutdown).
	go reaper(terminatingReaper)

	var ideWG sync.WaitGroup
	ideWG.Add(1)
	go startAndWatchIDE(ctx, cfg, &ideWG, ideReady)

	var wg sync.WaitGroup
	wg.Add(1)
	go startContentInit(ctx, cfg, &wg, cstate)
	wg.Add(1)
	go startAPIEndpoint(ctx, cfg, &wg, apiServices, tunneledPortsService, apiEndpointOpts...)
	wg.Add(1)
	go startSSHServer(ctx, cfg, &wg)
	wg.Add(1)
	go taskManager.Run(ctx, &wg)
	wg.Add(1)
	go socketActivationForDocker(ctx, &wg, termMux)

	if !cfg.isHeadless() {
		wg.Add(1)
		go portMgmt.Run(ctx, &wg)
	}

	if cfg.PreventMetadataAccess {
		go func() {
			if !hasMetadataAccess() {
				return
			}

			log.Error("metadata access is possible - shutting down")
			close(shutdown)
		}()
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	select {
	case <-sigChan:
	case <-shutdown:
	}

	log.Info("received SIGTERM - tearing down")
	terminatingReaper <- true
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

func configureGit(cfg *Config) {
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
	// We did not see an error. That's a problem becuase that means that users can reach the metadata endpoint.
	if err == nil {
		resp.Body.Close()
		return true
	}

	// if we see any error here we're good because then the request timed out or failed for some other reason.
	return false
}

func reaper(terminatingReaper <-chan bool) {
	defer log.Debug("reaper shutdown")

	var terminating bool
	sigs := make(chan os.Signal, 128)
	signal.Notify(sigs, syscall.SIGCHLD)
	for {
		select {
		case <-sigs:
		case terminating = <-terminatingReaper:
			continue
		}

		// "pid: 0, options: 0" to follow https://github.com/ramr/go-reaper/issues/11 to make agent-smith work again
		pid, err := unix.Wait4(0, nil, 0, nil)

		if err == unix.ECHILD {
			// The calling process does not have any unwaited-for children.
			continue
		}
		if err != nil {
			log.WithField("pid", pid).WithError(err).Debug("cannot call waitpid() for re-parented child")
			continue
		}

		if !terminating {
			continue
		}
		proc, err := os.FindProcess(pid)
		if err != nil {
			log.WithField("pid", pid).WithError(err).Debug("cannot find re-parented process")
			continue
		}
		err = proc.Signal(syscall.SIGTERM)
		if err != nil {
			if !strings.Contains(err.Error(), "os: process already finished") {
				log.WithField("pid", pid).WithError(err).Debug("cannot send SIGTERM to re-parented process")
			}

			continue
		}
		log.WithField("pid", pid).Debug("SIGTERM'ed reparented child process")
	}
}

func startAndWatchIDE(ctx context.Context, cfg *Config, wg *sync.WaitGroup, ideReady *ideReadyState) {
	defer wg.Done()
	defer log.Debug("startAndWatchIDE shutdown")

	if cfg.isHeadless() {
		ideReady.Set(true)
		return
	}

	type status int
	const (
		statusNeverRan status = iota
		statusShouldRun
		statusShouldShutdown
	)
	s := statusNeverRan

	var (
		cmd        *exec.Cmd
		ideStopped chan struct{}
	)
supervisorLoop:
	for {
		if s == statusShouldShutdown {
			break
		}

		ideStopped = make(chan struct{}, 1)
		go func() {
			cmd = prepareIDELaunch(cfg)

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
				if s == statusNeverRan {
					log.WithError(err).Fatal("IDE failed to start")
				}

				return
			}
			s = statusShouldRun

			go func() {
				runIDEReadinessProbe(cfg)
				ideReady.Set(true)
			}()

			err = cmd.Wait()
			if err != nil && !(strings.Contains(err.Error(), "signal: interrupt") || strings.Contains(err.Error(), "wait: no child processes")) {
				log.WithError(err).Warn("IDE was stopped")

				ideWasReady := ideReady.Get()
				if !ideWasReady {
					log.WithError(err).Fatal("IDE failed to start")
					return
				}
			}

			ideReady.Set(false)
			close(ideStopped)
		}()

		select {
		case <-ideStopped:
			// IDE was stopped - let's just restart it after a small delay (in case the IDE doesn't start at all) in the next round
			if s == statusShouldShutdown {
				break supervisorLoop
			}
			time.Sleep(1 * time.Second)
		case <-ctx.Done():
			// we've been asked to shut down
			s = statusShouldShutdown
			cmd.Process.Signal(os.Interrupt)
			break supervisorLoop
		}
	}

	log.WithField("budget", timeBudgetIDEShutdown.String()).Info("IDE supervisor loop ended - waiting for IDE to come down")
	select {
	case <-ideStopped:
		return
	case <-time.After(timeBudgetIDEShutdown):
		log.WithField("timeBudgetIDEShutdown", timeBudgetIDEShutdown.String()).Error("IDE did not stop in time - sending SIGKILL")
		cmd.Process.Signal(syscall.SIGKILL)
	}
}

func prepareIDELaunch(cfg *Config) *exec.Cmd {
	var args []string
	args = append(args, cfg.WorkspaceRoot)
	args = append(args, "--port", strconv.Itoa(cfg.IDEPort))
	args = append(args, "--hostname", "0.0.0.0")
	log.WithField("args", args).WithField("entrypoint", cfg.Entrypoint).Info("launching IDE")

	cmd := exec.Command(cfg.Entrypoint, args...)
	cmd.Env = buildIDEEnv(cfg)

	// We need the IDE to run in its own process group, s.t. we can suspend and resume
	// IDE and its children.
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid:   true,
		Pdeathsig: syscall.SIGKILL,
		Credential: &syscall.Credential{
			Uid: 33333,
			Gid: 33333,
		},
	}

	// Here we must resist the temptation to "neaten up" the IDE output for headless builds.
	// This would break the JSON parsing of the headless builds.
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if lrr := cfg.LogRateLimit(); lrr > 0 {
		limit := int64(lrr)
		cmd.Stdout = dropwriter.Writer(cmd.Stdout, dropwriter.NewBucket(limit*1024*3, limit*1024))
		cmd.Stderr = dropwriter.Writer(cmd.Stderr, dropwriter.NewBucket(limit*1024*3, limit*1024))
		log.WithField("limit_kb_per_sec", limit).Info("rate limiting IDE log output")
	}

	return cmd
}

func buildIDEEnv(cfg *Config) []string {
	var env, envn []string
	for _, e := range os.Environ() {
		segs := strings.Split(e, "=")
		if len(segs) < 2 {
			log.Printf("\"%s\" has invalid format, not including in IDE environment", e)
			continue
		}
		nme := segs[0]

		if isBlacklistedEnvvar(nme) {
			continue
		}

		env = append(env, e)
		envn = append(envn, nme)
	}

	ce := map[string]string{
		"SUPERVISOR_ADDR": fmt.Sprintf("localhost:%d", cfg.APIEndpointPort),
	}
	for nme, val := range ce {
		log.WithField("envvar", nme).Debug("passing environment variable to IDE")
		env = append(env, fmt.Sprintf("%s=%s", nme, val))
		envn = append(envn, nme)
	}

	log.WithField("envvar", envn).Debug("passing environment variables to IDE")

	return env
}

func runIDEReadinessProbe(cfg *Config) {
	defer log.Info("IDE is ready")

	switch cfg.ReadinessProbe.Type {
	case ReadinessProcessProbe:
		return

	case ReadinessHTTPProbe:
		var (
			url    = fmt.Sprintf("http://localhost:%d/%s", cfg.IDEPort, strings.TrimPrefix(cfg.ReadinessProbe.HTTPProbe.Path, "/"))
			client = http.Client{Timeout: 5 * time.Second}
			tick   = time.NewTicker(5 * time.Second)
		)
		defer tick.Stop()
		for {
			resp, err := client.Get(url)
			if err != nil {
				log.WithError(err).Info("IDE is not ready yet")
			} else if resp.StatusCode != http.StatusOK {
				log.WithField("status", resp.StatusCode).Info("IDE readiness probe came back with non-200 status code")
			} else {
				break
			}

			<-tick.C
		}
	}
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
		conn.Wait()
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
		newCh.Reject(ssh.Prohibited, err.Error())
		return
	}

	tunnel, err := tunneled.EstablishTunnel(ctx, tunnelReq.ClientId, tunnelReq.Port, tunnelReq.TargetPort)
	if err != nil {
		log.WithError(err).Error("tunnel: failed to establish")
		newCh.Reject(ssh.Prohibited, err.Error())
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

func startSSHServer(ctx context.Context, cfg *Config, wg *sync.WaitGroup) {
	defer wg.Done()

	bin, err := os.Executable()
	if err != nil {
		log.WithError(err).Error("cannot find executable path")
		return
	}
	dropbear := filepath.Join(filepath.Dir(bin), "dropbear", "dropbear")
	if _, err := os.Stat(dropbear); err != nil {
		log.WithError(err).WithField("path", dropbear).Error("cannot locate dropebar binary")
		return
	}
	dropbearkey := filepath.Join(filepath.Dir(bin), "dropbear", "dropbearkey")
	if _, err := os.Stat(dropbearkey); err != nil {
		log.WithError(err).WithField("path", dropbearkey).Error("cannot locate dropebarkey")
		return
	}

	hostkeyFN, err := ioutil.TempFile("", "hostkey")
	if err != nil {
		log.WithError(err).Error("cannot create hostkey file")
		return
	}
	hostkeyFN.Close()
	os.Remove(hostkeyFN.Name())

	out, err := exec.Command(dropbearkey, "-t", "rsa", "-f", hostkeyFN.Name()).CombinedOutput()
	if err != nil {
		log.WithError(err).WithField("out", string(out)).Error("cannot create hostkey file")
		return
	}

	cmd := exec.Command(dropbear, "-F", "-E", "-w", "-s", "-p", fmt.Sprintf(":%d", cfg.SSHPort), "-r", hostkeyFN.Name())
	cmd.Env = buildIDEEnv(cfg)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Start()
	if err != nil {
		log.WithError(err).Error("cannot start SSH server")
		return
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()
	select {
	case <-ctx.Done():
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		return
	case err = <-done:
		if err != nil {
			log.WithError(err).Error("SSH server stopped")
		}
	}
}

func startContentInit(ctx context.Context, cfg *Config, wg *sync.WaitGroup, cst ContentState) {
	defer wg.Done()
	defer log.Info("supervisor: workspace content available")

	var err error
	defer func() {
		if err == nil {
			return
		}

		ferr := os.WriteFile("/dev/termination-log", []byte(err.Error()), 0644)
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
		log.WithError(err).WithField("pid", pid).Warn("cannot terminate child process")
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
	}
	_ = os.Chown(fn, 33333, 33333)
	err = activation.Listen(ctx, l, func(socketFD *os.File) error {
		cmd := exec.Command("docker-up")
		cmd.Env = append(os.Environ(), "LISTEN_FDS=1")
		cmd.ExtraFiles = []*os.File{socketFD}
		_, err := term.Start(cmd, terminal.TermOptions{
			Annotations: map[string]string{
				"supervisor": "true",
			},
			LogToStdout: true,
		})
		return err
	})
	if err != nil {
		log.WithError(err).Error("cannot provide Docker activation socket")
	}
}

func analyseConfigChanges(ctx context.Context, wscfg *Config, w analytics.Writer, cfgobs gitpod.ConfigInterface) {
	cfgc, errc := cfgobs.Observe(ctx)
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
		case c := <-cfgc:
			if c == nil {
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
				{"ports", func(gc *gitpod.GitpodConfig) interface{} { return gc.Ports }},
				{"tasks", func(gc *gitpod.GitpodConfig) interface{} { return gc.Tasks }},
				{"prebuild", func(gc *gitpod.GitpodConfig) interface{} {
					if gc.Github == nil {
						return nil
					}
					return gc.Github.Prebuilds
				}},
			}
			for _, ch := range pch {
				prev, _ := computeHash(ch.G(cfg))
				curr, _ := computeHash(ch.G(c))
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
		case <-errc:
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
	cmd.SysProcAttr.Credential.Gid = 33333
	cmd.SysProcAttr.Credential.Uid = 33333
	return cmd
}
