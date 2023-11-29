/*?sr/bin/env go run "$0" "$@"; exit $? #*/
// Source: https://gist.github.com/fsmv/02c636d4da58106f113049ee45a62f50
package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"slices"
	"syscall"

	log "github.com/sirupsen/logrus"
	"golang.org/x/sync/errgroup"
)

const (
	ROOT_DIR = "/workspace/gitpod"
)

type config struct {
	basePath string
	hostUrl  *url.URL
}

var components = []component{
	&generic{name: "services", componentPath: "components/server", startCommand: []string{"yarn", "start-services"}, stopCommand: []string{"yarn", "stop-services"}, mute: []string{"stdout"}},
	&generic{name: "proxy", componentPath: "components/proxy", startCommand: []string{"./devserver.sh"}},
	&generic{name: "dashboard", componentPath: "components/dashboard", startCommand: []string{"yarn", "devserver"}},
	&generic{name: "server", componentPath: "components/server", startCommand: []string{"yarn", "devserver"}, configTemplatePath: "dev/config.json"},
}

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("usage: devserver <hostUrl>")
	}

	hostUrl := os.Args[1]
	if hostUrl == "" {
		log.Fatalf("hostUrl is required")
	}
	u, err := url.Parse(hostUrl)
	if err != nil {
		log.Fatalf("hostUrl is invalid: %v", err)
	}
	log.Infof("hostUrl: %s", u.String())

	basePath, err := os.MkdirTemp("", "devserver")
	if err != nil {
		log.Fatalf("cannot create temp dir: %v", err)
	}
	cfg := &config{
		basePath: basePath,
		hostUrl:  u,
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer ctx.Done()

	cleanup := func() {
		fmt.Println("Stopping...")
		g := stop(ctx, cfg)
		if err := g.Wait(); err != nil {
			if err.Error() != "signal: interrupt" && err.Error() != "context canceled" {
				log.WithError(err).Error("error during stop")
			}
		}
		fmt.Println("Done.")
	}
	defer cleanup()

	g, ctx, err := start(ctx, cfg)
	if err != nil {
		if err.Error() != "signal: interrupt" {
			log.WithError(err).Error("error during start")
			return
		}
	}

	sigtermReceived := make(chan os.Signal, 1)
	cancelled := false
	signal.Notify(sigtermReceived, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigtermReceived
		log.Info("Signal received, stopping...")
		cancelled = true
		cancel()
	}()

	if err := g.Wait(); err != nil {
		if !cancelled {
			log.WithError(err).Error("error while running")
			return
		}
	}
}

func start(ctx context.Context, cfg *config) (*errgroup.Group, context.Context, error) {
	g, ctx := errgroup.WithContext(ctx)

	// TODO(gpl) add dns entries ala server.devserver.localdomain

	for _, c := range components {
		c := c
		g.Go(func() error {
			err := c.Start(ctx, cfg)
			return fmt.Errorf("error running %s: %w", c.Name(), err)
		})
	}

	return g, ctx, nil
}

func stop(ctx context.Context, cfg *config) *errgroup.Group {
	g, _ := errgroup.WithContext(ctx)

	g.Go(func() error {
		return os.RemoveAll(cfg.basePath)
	})

	for _, c := range components {
		c := c
		g.Go(func() error {
			return c.Stop(ctx, cfg)
		})
	}

	return g
}

type component interface {
	Name() string
	Start(ctx context.Context, cfg *config) error
	Stop(ctx context.Context, cfg *config) error
}

type generic struct {
	name string
	// componentPath is the relative componentPath from the repo root to the component dir
	componentPath      string
	configTemplatePath string
	startCommand       []string
	stopCommand        []string
	mute               []string
	// env map[string]string
}

type Env struct {
	key   string
	value string
}

func (g *generic) Name() string {
	return g.name
}

func (g *generic) DefaultEnv(cfg *config) []Env {
	return []Env{
		{key: "HOST_URL", value: cfg.hostUrl.String()},
		{key: "HOST_URL_HOSTNAME", value: cfg.hostUrl.Hostname()},
		{key: "GITPOD_DOMAIN", value: cfg.hostUrl.Hostname()},
		{key: "KUBE_DOMAIN", value: "localdomain"},
		{key: "KUBE_NAMESPACE", value: "devserver"},
		{key: "WORKSPACE_HANDLER_FILE", value: "full"},
		{key: "CONFIGCAT_DIR", value: "/data/configcat"},
		{key: "GITPOD_ANALYTICS_WRITER", value: "log"}, // gpl: worth an option?
		// TODO(gpl) Really, we started this game again? TODO: move to config file
		{key: "SPICEDB_ADDRESS", value: "localhost:50051"},
		{key: "SPICEDB_PRESHARED_KEY", value: "daf0afed-e468-4a7b-bc69-1334c0670424"},
	}
}

func (g *generic) Start(ctx context.Context, cfg *config) (err error) {
	configBasePath := path.Join(cfg.basePath, g.componentPath)
	err = os.MkdirAll(configBasePath, 0755)
	if err != nil {
		return err
	}

	envs := g.DefaultEnv(cfg)

	if g.configTemplatePath != "" {
		// copy config template over
		configSource := path.Join(ROOT_DIR, g.componentPath, g.configTemplatePath)
		input, e := os.ReadFile(configSource)
		if e != nil {
			return e
		}

		// and replace env vars
		for _, env := range envs {
			input = bytes.ReplaceAll(input, []byte(fmt.Sprintf("${%s}", env.key)), []byte(env.value))
		}

		configDest := path.Join(configBasePath, g.configTemplatePath)
		err = os.MkdirAll(path.Dir(configDest), 0755)
		if err != nil {
			return err
		}
		err = os.WriteFile(configDest, input, 0755)
		if err != nil {
			return err
		}
		envs = append(envs, Env{key: "CONFIG_PATH", value: configDest}) // special case for server
	}

	return g.run(ctx, g.startCommand, envs...)
}

func (g *generic) Stop(ctx context.Context, cfg *config) (err error) {
	if len(g.stopCommand) > 0 {
		envs := g.DefaultEnv(cfg)
		return g.run(ctx, g.stopCommand, envs...)
	}
	return nil
}

func (g *generic) run(ctx context.Context, command []string, envs ...Env) error {
	c := exec.CommandContext(ctx, command[0], command[1:]...)
	c.Dir = path.Join(ROOT_DIR, g.componentPath)
	c.Env = append(os.Environ(), Map(envs, func(env Env) string { return fmt.Sprintf("%s=%s", env.key, env.value) })...)
	if !slices.Contains(g.mute, "stdout") {
		c.Stdout = NewPrefixer(g.name, os.Stdout)
	}
	if !slices.Contains(g.mute, "stderr") {
		c.Stderr = NewPrefixer(g.name, os.Stderr)
	}
	return c.Run()
}

type prefixer struct {
	prefix          string
	sink            io.Writer
	trailingNewline bool
	buf             bytes.Buffer
}

func NewPrefixer(prefix string, sink io.Writer) *prefixer {
	return &prefixer{
		prefix:          prefix,
		sink:            sink,
		trailingNewline: true,
	}
}

func (pf *prefixer) Write(payload []byte) (int, error) {
	pf.buf.Reset() // clear the buffer

	for _, b := range payload {
		if pf.trailingNewline {
			pf.buf.WriteString(fmt.Sprintf("[%s] ", pf.prefix))
			pf.trailingNewline = false
		}

		pf.buf.WriteByte(b)

		if b == '\n' {
			// do not print the prefix right after the newline character as this might
			// be the very last character of the stream and we want to avoid a trailing prefix.
			pf.trailingNewline = true
		}
	}

	n, err := pf.sink.Write(pf.buf.Bytes())
	if err != nil {
		if n > len(payload) {
			n = len(payload)
		}
		return n, err
	}

	return len(payload), nil
}
func (pf *prefixer) EnsureNewline() {
	if !pf.trailingNewline {
		fmt.Fprintln(pf.sink)
	}
}

func Map[T, V any](ts []T, fn func(T) V) []V {
	result := make([]V, len(ts))
	for i, t := range ts {
		result[i] = fn(t)
	}
	return result
}
