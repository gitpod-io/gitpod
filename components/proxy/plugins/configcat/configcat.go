// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package configcat

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

const (
	configCatModule = "gitpod.configcat"
)

var (
	DefaultConfig = []byte("{}")
	pathRegex     = regexp.MustCompile(`^/configcat/configuration-files/gitpod/config_v\d+\.json$`)
)

func init() {
	caddy.RegisterModule(ConfigCat{})
	httpcaddyfile.RegisterHandlerDirective(configCatModule, parseCaddyfile)
}

type configCache struct {
	data []byte
	hash string
}

// ConfigCat implements an configcat config CDN
type ConfigCat struct {
	sdkKey string
	// baseUrl of configcat, default https://cdn-global.configcat.com
	baseUrl string
	// pollInterval sets after how much time a configuration is considered stale.
	pollInterval time.Duration

	configCatConfigDir string

	configCache map[string]*configCache
	m           sync.RWMutex

	httpClient *http.Client
	logger     *zap.Logger
}

// CaddyModule returns the Caddy module information.
func (ConfigCat) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.gitpod_configcat",
		New: func() caddy.Module { return new(ConfigCat) },
	}
}

func (c *ConfigCat) ServeFromFile(w http.ResponseWriter, r *http.Request, fileName string) {
	fp := path.Join(c.configCatConfigDir, fileName)
	d, err := os.Stat(fp)
	if err != nil {
		// This should only happen before deploying the FF resource, and logging would not be helpful, hence we can fallback to the default values.
		_, _ = w.Write(DefaultConfig)
		return
	}
	requestEtag := r.Header.Get("If-None-Match")
	etag := fmt.Sprintf(`W/"%x-%x"`, d.ModTime().Unix(), d.Size())
	if requestEtag != "" && requestEtag == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("ETag", etag)
	http.ServeFile(w, r, fp)
}

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (c *ConfigCat) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	if !pathRegex.MatchString(r.URL.Path) {
		return next.ServeHTTP(w, r)
	}
	arr := strings.Split(r.URL.Path, "/")
	configVersion := arr[len(arr)-1]

	// ensure that the browser must revalidate it, but still cache it
	w.Header().Set("Cache-Control", "no-cache")

	if c.configCatConfigDir != "" {
		c.ServeFromFile(w, r, configVersion)
		return nil
	}

	w.Header().Set("Content-Type", "application/json")
	if c.sdkKey == "" {
		_, _ = w.Write(DefaultConfig)
		return nil
	}
	etag := r.Header.Get("If-None-Match")

	config := c.getConfigWithCache(configVersion)
	if etag != "" && config.hash == etag {
		w.WriteHeader(http.StatusNotModified)
		return nil
	}
	if config.hash != "" {
		w.Header().Set("ETag", config.hash)
	}
	w.Write(config.data)
	return nil
}

func (c *ConfigCat) Provision(ctx caddy.Context) error {
	c.logger = ctx.Logger(c)
	c.configCache = make(map[string]*configCache)

	c.sdkKey = os.Getenv("CONFIGCAT_SDK_KEY")
	c.configCatConfigDir = os.Getenv("CONFIGCAT_DIR")
	if c.sdkKey == "" {
		return nil
	}
	if c.configCatConfigDir != "" {
		c.logger.Info("serving configcat configuration from local directory")
		return nil
	}

	c.httpClient = &http.Client{
		Timeout: 10 * time.Second,
	}
	c.baseUrl = os.Getenv("CONFIGCAT_BASE_URL")
	if c.baseUrl == "" {
		c.baseUrl = "https://cdn-global.configcat.com"
	}
	dur, err := time.ParseDuration(os.Getenv("CONFIGCAT_POLL_INTERVAL"))
	if err != nil {
		c.pollInterval = time.Minute
		c.logger.Warn("cannot parse poll interval of configcat, default to 1m")
	} else {
		c.pollInterval = dur
	}

	// poll config
	go func() {
		for range time.Tick(c.pollInterval) {
			for version, cache := range c.configCache {
				c.updateConfigCache(version, cache)
			}
		}
	}()
	return nil
}

func (c *ConfigCat) getConfigWithCache(configVersion string) *configCache {
	c.m.RLock()
	data := c.configCache[configVersion]
	c.m.RUnlock()
	if data != nil {
		return data
	}
	return c.updateConfigCache(configVersion, nil)
}

func (c *ConfigCat) updateConfigCache(version string, prevConfig *configCache) *configCache {
	t, err := c.fetchConfigCatConfig(version, prevConfig)
	if err != nil {
		return &configCache{
			data: DefaultConfig,
			hash: "",
		}
	}
	c.m.Lock()
	c.configCache[version] = t
	c.m.Unlock()
	return t
}

var sg = &singleflight.Group{}

// fetchConfigCatConfig with different config version. i.e. config_v5.json
func (c *ConfigCat) fetchConfigCatConfig(version string, prevConfig *configCache) (*configCache, error) {
	b, err, _ := sg.Do(fmt.Sprintf("fetch_%s", version), func() (interface{}, error) {
		url := fmt.Sprintf("%s/configuration-files/%s/%s", c.baseUrl, c.sdkKey, version)
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			c.logger.With(zap.Error(err)).Error("cannot create request")
			return nil, err
		}
		if prevConfig != nil && prevConfig.hash != "" {
			req.Header.Add("If-None-Match", prevConfig.hash)
		}
		resp, err := c.httpClient.Do(req)
		if err != nil {
			c.logger.With(zap.Error(err)).Error("cannot fetch configcat config")
			return nil, err
		}

		if resp.StatusCode == 304 {
			return prevConfig, nil
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			b, err := ioutil.ReadAll(resp.Body)
			if err != nil {
				c.logger.With(zap.Error(err), zap.String("version", version)).Error("cannot read configcat config response")
				return nil, err
			}
			return &configCache{
				data: b,
				hash: resp.Header.Get("Etag"),
			}, nil
		}
		return nil, fmt.Errorf("received unexpected response %v", resp.Status)
	})
	if err != nil {
		return nil, err
	}
	return b.(*configCache), nil
}

// UnmarshalCaddyfile implements Caddyfile.Unmarshaler.
func (m *ConfigCat) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	return nil
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	m := new(ConfigCat)
	err := m.UnmarshalCaddyfile(h.Dispenser)
	if err != nil {
		return nil, err
	}

	return m, nil
}

// Interface guards
var (
	_ caddyhttp.MiddlewareHandler = (*ConfigCat)(nil)
	_ caddyfile.Unmarshaler       = (*ConfigCat)(nil)
)
