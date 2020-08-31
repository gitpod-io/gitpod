// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
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
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/content-service/pkg/executor"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/supervisor/pkg/backup"
	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/soheilhy/cmux"
	"google.golang.org/grpc"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "theia-supervisor"
	// Version of this service - set during build
	Version = ""
)

const (
	configFile = "supervisor-config.json"
	help       = `This program launches Theia and keeps it alive.

Configuration is done using env vars:
         THEIA_ENTRYPOINT  The entrypoint/executable to run when starting Theia.
	 THEIA_WORKSPACE_ROOT  The location in the filesystem where the workspace lives.
	 	 GITPOD_REPO_ROOT  The absolute checkout location of the Git repo. If there's no Git repo, leave this empty.
        GITPOD_THEIA_PORT  The port Theia will listen on.
THEIA_SUPERVISOR_ENDPOINT  The address on which the supervisor health endpoint is served on.
     THEIA_SUPERVISOR_KEY  Bearer token for the health endpoint.
         THEIA_SHELL_ARGS  Optional. Sets arguments passed to shells spawned by Theia.
		   THEIA_ARGS_ADD  Optional. Sets arguments wich get appended to the Theia arguments.
	  THEIA_RATELIMIT_LOG  Optional. Sets a rate limit for Theia log output in kib/sec.
	 GITPOD_GIT_USER_NAME  Optional. Makes supervisor configure the global user.name Git setting.
	GITPOD_GIT_USER_EMAIL  Optional. Makes supervisor configure the global user.email Git setting.

Additionally to env vars, supervisor attempts to read a file supervisor-config.json in the current
working directory. See the Config struct for more details. Envvar values overwrite config file values.
`

	maxTheiaPause = 20 * time.Second
)

// Config is the configuration of the Theia watchdog
type Config struct {
	Entrypoint            string `json:"entrypoint"`
	TheiaWorkspaceRoot    string `json:"workspaceRoot"`
	RepoRoot              string `json:"repoRoot"`
	GitpodTheiaPort       int    `json:"theiaPort"`
	TheiaShellArgs        string `json:"shellArgs"`
	TheiaArgsAdd          string
	TheiaRatelimitLog     string `json:"ratelimitLogs"`
	HealthEndpointAddr    string `json:"healthEndpoint"`
	PreventMetadataAccess bool   `json:"preventMetadataAccess"`
	SupervisorAuthToken   string `json:"-"`
	Git                   struct {
		Name  string
		Email string
	} `json:"-"`
}

// GetConfigFromEnv extracts the config from environment variables
func getConfig() (*Config, error) {
	var cfg Config
	loadConfigFromFile(&cfg)

	if cfg.Entrypoint == "" {
		cfg.Entrypoint = os.Getenv("THEIA_ENTRYPOINT")
	}
	if cfg.Entrypoint == "" {
		return nil, fmt.Errorf("THEIA_ENTRYPOINT envvar is mandatory")
	}
	if stat, err := os.Stat(cfg.Entrypoint); os.IsNotExist(err) {
		return nil, fmt.Errorf("$THEIA_ENTRYPOINT (=%s) does not exist", cfg.Entrypoint)
	} else if err != nil {
		return nil, err
	} else if stat.IsDir() {
		return nil, fmt.Errorf("$THEIA_ENTRYPOINT (=%s) is not a file", cfg.Entrypoint)
	}

	if cfg.TheiaWorkspaceRoot == "" {
		cfg.TheiaWorkspaceRoot = os.Getenv("THEIA_WORKSPACE_ROOT")
	}
	if cfg.TheiaWorkspaceRoot == "" {
		return nil, fmt.Errorf("THEIA_WORKSPACE_ROOT envvar is mandatory")
	}
	if cfg.RepoRoot == "" {
		cfg.RepoRoot = os.Getenv("GITPOD_REPO_ROOT")
	}

	if cfg.GitpodTheiaPort == 0 {
		gpTheiaPort := os.Getenv("GITPOD_THEIA_PORT")
		port, err := strconv.Atoi(gpTheiaPort)
		if err != nil {
			return nil, fmt.Errorf("cannot parse $GITPOD_THEIA_PORT (=%s): %v", gpTheiaPort, err)
		}
		cfg.GitpodTheiaPort = port
	}

	if cfg.TheiaShellArgs == "" {
		cfg.TheiaShellArgs = os.Getenv("THEIA_SHELL_ARGS")
	}
	if cfg.TheiaArgsAdd == "" {
		cfg.TheiaArgsAdd = os.Getenv("THEIA_ARGS_ADD")
	}
	if cfg.TheiaRatelimitLog == "" {
		cfg.TheiaRatelimitLog = os.Getenv("THEIA_RATELIMIT_LOG")
	}

	if cfg.HealthEndpointAddr == "" {
		cfg.HealthEndpointAddr = os.Getenv("THEIA_SUPERVISOR_ENDPOINT")
	}
	if cfg.HealthEndpointAddr == "" {
		return nil, fmt.Errorf("THEIA_SUPERVISOR_ENDPOINT envvar is mandatory")
	}

	pmd := os.Getenv("THEIA_PREVENT_METADATA_ACCESS")
	if pmd == "true" {
		cfg.PreventMetadataAccess = true
	}

	cfg.SupervisorAuthToken = os.Getenv("THEIA_SUPERVISOR_TOKEN")

	cfg.Git.Name = os.Getenv("GITPOD_GIT_USER_NAME")
	cfg.Git.Email = os.Getenv("GITPOD_GIT_USER_EMAIL")

	return &cfg, nil
}

func loadConfigFromFile(cfg *Config) {
	loc, err := os.Executable()
	if err != nil {
		log.WithError(err).WithField("configFile", configFile).Debug("cannot get executable path - dismissing any config file")
		return
	}
	candidates := []string{
		configFile,
		filepath.Join(filepath.Dir(loc), configFile),
	}

	for _, loc := range candidates {
		fc, err := ioutil.ReadFile(loc)
		if err != nil {
			log.WithField("configFile", loc).WithError(err).Debug("config file cannot be read - ignoring")
			continue
		}

		err = json.Unmarshal(fc, &cfg)
		if err != nil {
			log.WithError(err).WithField("configFile", loc).Warn("cannot unmarshal config file - ignoring")
			continue
		}

		log.WithField("configFile", loc).WithField("config", cfg).Info("read config file")
		break
	}
}

type runOptions struct {
	Args                   []string
	AdditionalServices     []func(*grpc.Server)
	HealthEndpointGRPCOpts []grpc.ServerOption
}

// RunOption customizes the run behaviour
type RunOption func(*runOptions)

// WithArgs sets the arguments passed to Run
func WithArgs(args []string) RunOption {
	return func(r *runOptions) {
		r.Args = args
	}
}

// WithAdditionalService registers an additional gRPC service on the health endpoint
func WithAdditionalService(register func(*grpc.Server)) RunOption {
	return func(r *runOptions) {
		r.AdditionalServices = append(r.AdditionalServices, register)
	}
}

// WithHealthEndpointGRPCOpt adds server options to the health endpoint gRPC server
func WithHealthEndpointGRPCOpt(opt grpc.ServerOption) RunOption {
	return func(r *runOptions) {
		r.HealthEndpointGRPCOpts = append(r.HealthEndpointGRPCOpts, opt)
	}
}

// Run serves as main entrypoint to the supervisor
func Run(options ...RunOption) {
	opts := runOptions{
		Args: os.Args,
	}
	for _, o := range options {
		o(&opts)
	}

	if len(opts.Args) > 1 && opts.Args[1] == "help" {
		fmt.Println(help)
		return
	}
	if len(opts.Args) < 2 || opts.Args[1] == "drop" {
		out := dropwriter.Writer(os.Stdout, dropwriter.NewBucket(128, 64))
		io.Copy(out, os.Stdin)
		return
	}

	cfg, err := getConfig()
	if err != nil {
		log.WithError(err).Fatal("configuration error")
	}
	if len(os.Args) > 1 && os.Args[1] == "backup" {
		err := triggerAndWaitForBackup(cfg)
		if err != nil {
			log.WithError(err).Fatal("cannot produce backup")
		}
		return
	}
	if len(os.Args) < 2 || os.Args[1] != "run" {
		fmt.Println("supervisor makes sure your workspace/Theia keeps running smoothly.\nYou don't have to call this thing, Gitpod calls it for you.")
		return
	}

	log.Init(ServiceName, Version, true, true)
	buildTheiaEnv(&Config{})
	configureGit(cfg)

	ctx, cancel := context.WithCancel(context.Background())
	var (
		shutdown   = make(chan struct{})
		pauseTheia = make(chan bool)
		iwh        = backup.NewInWorkspaceHelper(cfg.RepoRoot, pauseTheia)
	)

	var wg sync.WaitGroup
	wg.Add(3)
	go startAndWatchTheia(ctx, cfg, &wg, pauseTheia)
	go startHealthEndpoint(ctx, cfg, &wg, iwh, &opts)
	go startContentInit(ctx, cfg, &wg, iwh)

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

	cancel()
	wg.Wait()
}

func configureGit(cfg *Config) {
	settings := [][]string{
		{"push.default", "simple"},
		{"alias.lg", "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"},
		{"credential.helper", "/usr/bin/gp credential-helper"},
	}
	if cfg.Git.Name != "" {
		settings = append(settings, []string{"user.name", cfg.Git.Name})
	}
	if cfg.Git.Email != "" {
		settings = append(settings, []string{"user.email", cfg.Git.Email})
	}

	for _, s := range settings {
		cmd := exec.Command("git", append([]string{"config", "--global"}, s...)...)
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

func startAndWatchTheia(ctx context.Context, cfg *Config, wg *sync.WaitGroup, pauseChan <-chan bool) {
	defer wg.Done()

	type status int
	const (
		statusNeverRan status = iota
		statusShouldRun
		statusShouldShutdown
	)
	s := statusNeverRan

	var (
		cmd          *exec.Cmd
		theiaStopped chan struct{}
	)
supervisorLoop:
	for {
		if s != statusShouldShutdown {
			theiaStopped = make(chan struct{}, 1)

			cmd = prepareTheiaLaunch(cfg)
			err := cmd.Start()
			if err != nil {
				if s == statusNeverRan {
					log.WithError(err).Fatal("Theia failed to start")
				}

				continue
			}
			s = statusShouldRun

			go func() {
				var (
					paused bool
					t      = time.NewTimer(maxTheiaPause)
				)
				for {
					select {
					case pause := <-pauseChan:
						if pause {
							t.Stop()
							t.Reset(maxTheiaPause)
							paused = true

							cmd.Process.Signal(syscall.SIGTSTP)
						} else {
							paused = false
							cmd.Process.Signal(syscall.SIGCONT)
						}
					case <-t.C:
						if paused {
							paused = false
							cmd.Process.Signal(syscall.SIGCONT)
						}
					case <-theiaStopped:
						return
					}
				}
			}()

			go func() {
				err := cmd.Wait()
				log.WithError(err).Warn("Theia was stopped")

				close(theiaStopped)
			}()
		}

		select {
		case <-theiaStopped:
			// Theia was stopped - let's just restart it after a small delay (in case Theia doesn't start at all) in the next round
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

	log.Info("Theia supervisor loop ended - waiting for Theia to come down")
	select {
	case <-theiaStopped:
		return
	case <-time.After(30 * time.Second):
		log.Fatal("Theia did not stop after 30 seconds")
	}
}

func prepareTheiaLaunch(cfg *Config) *exec.Cmd {
	var args []string
	args = append(args, cfg.TheiaWorkspaceRoot)
	args = append(args, "--port", strconv.Itoa(cfg.GitpodTheiaPort))
	args = append(args, "--hostname", "0.0.0.0")
	args = append(args, strings.Split(cfg.TheiaArgsAdd, " ")...)
	log.WithField("args", args).WithField("entrypoint", cfg.Entrypoint).Info("launching Theia")

	cmd := exec.Command(cfg.Entrypoint, args...)
	cmd.Env = buildTheiaEnv(cfg)

	// We need Theia to run in its own process group, s.t. we can suspend and resume
	// theia and its children.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	// Here we must resist the temptation to "neaten up" the Theia output for headless builds.
	// This would break the JSON parsing of the headless builds.
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if cfg.TheiaRatelimitLog != "" {
		limit, err := strconv.ParseInt(cfg.TheiaRatelimitLog, 10, 64)
		if err != nil {
			log.WithError(err).WithField("ratelimit", cfg.TheiaRatelimitLog).Warn("cannot to parse log rate limit, not rate limiting")
		} else {
			log.WithField("limit_kb_per_sec", limit).Info("rate limiting Theia log output")
			cmd.Stdout = dropwriter.Writer(cmd.Stdout, dropwriter.NewBucket(limit*1024*3, limit*1024))
			cmd.Stderr = dropwriter.Writer(cmd.Stderr, dropwriter.NewBucket(limit*1024*3, limit*1024))
		}
	}

	return cmd
}

func buildTheiaEnv(cfg *Config) []string {
	var env []string
	for _, e := range os.Environ() {
		segs := strings.Split(e, "=")
		if len(segs) < 2 {
			log.Printf("\"%s\" has invalid format, not including in Theia environment", e)
			continue
		}
		nme := segs[0]

		if isBlacklistedEnvvar(nme) {
			continue
		}

		log.WithField("envvar", nme).Debug("passing environment variable to Theia")
		env = append(env, e)
	}

	ce := map[string]string{
		"THEIA_SHELL_ARGS": cfg.TheiaShellArgs,
	}
	for nme, val := range ce {
		log.WithField("envvar", nme).Debug("passing environment variable to Theia")
		env = append(env, fmt.Sprintf("%s=%s", nme, val))
	}

	return env
}

func isBlacklistedEnvvar(name string) bool {
	// exclude blacklisted
	prefixBlacklist := []string{
		"THEIA_SUPERVISOR_",
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

func startHealthEndpoint(ctx context.Context, cfg *Config, wg *sync.WaitGroup, iwh *backup.InWorkspaceHelper, opts *runOptions) {
	defer wg.Done()

	l, err := net.Listen("tcp", cfg.HealthEndpointAddr)
	if err != nil {
		log.WithError(err).Fatal("cannot start health endpoint")
	}

	m := cmux.New(l)
	grpcMux := m.MatchWithWriters(cmux.HTTP2MatchHeaderFieldSendSettings("content-type", "application/grpc"))
	grpcServer := grpc.NewServer(opts.HealthEndpointGRPCOpts...)
	iwh.Register(grpcServer)
	for _, reg := range opts.AdditionalServices {
		reg(grpcServer)
	}
	go grpcServer.Serve(grpcMux)

	httpMux := m.Match(cmux.HTTP1Fast())
	routes := http.NewServeMux()
	routes.HandleFunc("/", func(resp http.ResponseWriter, req *http.Request) {
		select {
		case <-req.Context().Done():
			resp.WriteHeader(http.StatusNotAcceptable)
		case <-iwh.ContentReady():
			resp.WriteHeader(http.StatusOK)
			resp.Write([]byte("OK"))
		}
	})
	routes.Handle("/api/", http.StripPrefix("/api", iwh.HTTPMux(cfg.HealthEndpointAddr)))
	go http.Serve(httpMux, routes)

	go m.Serve()

	<-ctx.Done()
	log.Info("shutting down health endpoint")
	l.Close()
}

func startContentInit(ctx context.Context, cfg *Config, wg *sync.WaitGroup, cst backup.ContentState) {
	defer wg.Done()
	defer log.Info("supervisor: workspace content available")

	var err error
	defer func() {
		if err == nil {
			return
		}

		ferr := ioutil.WriteFile("/dev/termination-log", []byte(err.Error()), 0644)
		if ferr != nil {
			log.WithError(err).Error("cannot write termination log")
		}

		log.WithError(err).Fatal("content initialization failed")
	}()

	fn := "/workspace/.gitpod/content.json"
	f, err := os.Open(fn)
	if os.IsNotExist(err) {
		log.WithError(err).Info("no content init descriptor found - not trying to run it")

		// If there is no content descriptor the content must have come from somewhere (i.e. a layer or ws-sync).
		// Let's wait for that to happen.
		// TODO: rewrite using fsnotify
		t := time.NewTicker(100 * time.Millisecond)
		for range t.C {
			b, err := ioutil.ReadFile("/workspace/.gitpod/ready")
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

	src, err := executor.Execute(ctx, "/workspace", f, initializer.WithInWorkspace)
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

func triggerAndWaitForBackup(cfg *Config) (err error) {
	var (
		segs       = strings.Split(cfg.HealthEndpointAddr, ":")
		prt  int64 = 80
	)
	if len(segs) > 1 {
		prt, err = strconv.ParseInt(segs[1], 10, 64)
		if err != nil {
			return err
		}
	}

	resp, err := http.Get(fmt.Sprintf("http://localhost:%d/api/v1/backup/prepare", int(prt)))
	if err != nil {
		return err
	}
	bd := resp.Body
	defer bd.Close()
	io.Copy(os.Stdout, bd)

	return nil
}
