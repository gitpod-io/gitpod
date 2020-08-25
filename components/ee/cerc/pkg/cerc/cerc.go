// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cerc

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"text/template"
	"time"

	"github.com/satori/go.uuid"
	log "github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

// Duration is a json-unmarshallable wrapper for time.Duration.
// See https://stackoverflow.com/questions/48050945/how-to-unmarshal-json-into-durations
type Duration time.Duration

// UnmarshalJSON unmarshales a duration using ParseDuration
func (d *Duration) UnmarshalJSON(b []byte) error {
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}

	switch value := v.(type) {
	case float64:
		*d = Duration(time.Duration(value))
		return nil
	case string:
		tmp, err := time.ParseDuration(value)
		if err != nil {
			return err
		}
		*d = Duration(tmp)
		return nil
	default:
		return xerrors.New("invalid duration")
	}
}

// BasicAuth configures basic authentication for HTTP requests or endpoints
type BasicAuth struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Pathway is the template for a full-circle test
type Pathway struct {
	Name           string     `json:"name"`
	Endpoint       string     `json:"endpoint"`
	Method         string     `json:"method"`
	Authentication *BasicAuth `json:"auth,omitempty"`
	Payload        string     `json:"payload,omitempty"`
	Timeouts       struct {
		Request  Duration `json:"request,omitempty"`
		Response Duration `json:"response,omitempty"`
	} `json:"timeouts,omitempty"`
	Period              Duration `json:"period,omitempty"`
	TriggerOnly         bool     `json:"triggerOnly,omitempty"`
	ResponseURLTemplate string   `json:"responseURLTemplate,omitempty"`
}

var validMethods = []string{http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodConnect, http.MethodOptions, http.MethodTrace}

func (p *Pathway) validate() error {
	if p.Name == "" {
		return xerrors.Errorf("Name is missing")
	}
	if p.Endpoint == "" {
		return xerrors.Errorf("Endpoint is missing")
	}
	if _, err := url.Parse(p.Endpoint); err != nil {
		return xerrors.Errorf("Endpoint is invalid: %w", err)
	}

	var isValidMethod bool
	for _, validMethod := range validMethods {
		if p.Method == validMethod {
			isValidMethod = true
			break
		}
	}
	if !isValidMethod {
		return xerrors.Errorf("Method \"%s\" is invalid", p.Method)
	}

	return nil
}

// Options configures a Cerc service instance
type Options struct {
	HTTPS struct {
		Cert string `json:"crt,omitempty"`
		Key  string `json:"key,omitempty"`
	} `json:"https,omitempty"`
	Pathways            []Pathway  `json:"pathways"`
	Address             string     `json:"address"`
	DefaultPeriod       Duration   `json:"defaultPeriod"`
	Auth                *BasicAuth `json:"auth,omitempty"`
	ResponseURLTemplate string     `json:"responseURLTemplate,omitempty"`
	FirstRunDelay       Duration   `json:"firstRunDelay"`
	Retries             int        `json:"retries"`
	RetryDelay          Duration   `json:"retryDelay"`
}

// fillInDefaults completes the options by setting default values if needed
func (c *Options) fillInDefaults() {
	if c.ResponseURLTemplate == "" {
		c.ResponseURLTemplate = defaultResponseURLTemplate
	}

	if c.DefaultPeriod == Duration(0*time.Second) {
		c.DefaultPeriod = Duration(30 * time.Second)
	}
	for i, pth := range c.Pathways {
		if pth.Period == Duration(0*time.Second) {
			c.Pathways[i].Period = c.DefaultPeriod
		}
		if pth.Timeouts.Request == Duration(0*time.Second) {
			c.Pathways[i].Timeouts.Request = Duration(5 * time.Second)
		}
		if pth.Timeouts.Response == Duration(0*time.Second) {
			c.Pathways[i].Timeouts.Response = pth.Period / Duration(2)
		}
	}

	if c.RetryDelay == Duration(0*time.Second) {
		c.RetryDelay = Duration(10 * time.Second)
	}
}

// validate ensures the options/configuration is valid
func (c *Options) validate() error {
	for _, pth := range c.Pathways {
		err := pth.validate()
		if err != nil {
			return xerrors.Errorf("pathway %s invalid: %w", pth.Name, err)
		}
	}

	if c.Address == "" {
		return xerrors.Errorf("Address is missing")
	}

	return nil
}

func newRunner(c *Cerc, pathway Pathway) *runner {
	log.WithField("pathway", pathway.Name).Debugf("creating runner with period %s", time.Duration(pathway.Period).String())
	return &runner{
		C:      c,
		P:      pathway,
		active: make(map[string]*probe),
	}
}

// runner actually probes/acts on a pathway
type runner struct {
	C *Cerc
	P Pathway

	mu     sync.Mutex
	active map[string]*probe
}

func (r *runner) Run() {

	// start with an inital run
	if r.C.Config.FirstRunDelay > Duration(0*time.Second) {
		time.Sleep(time.Duration(r.C.Config.FirstRunDelay))
	}
	go r.Probe()

	// start ticker for subsequent runs
	ticker := time.NewTicker(time.Duration(r.P.Period))
	for {
		<-ticker.C

		go r.Probe()
	}
}

const (
	// HeaderURL is the HTTP sent along with Cerc requests which contains the URL where we expect the resonse to
	HeaderURL = "X-Cerc-URL"

	// HeaderToken is the HTTP sent along with Cerc requests which contains the token to authenticate the response as
	HeaderToken = "X-Cerc-Token"

	// defaultResponseURLTemplate is used if no custom response URL template is configured
	defaultResponseURLTemplate = "{{ .Scheme }}://{{ .Address }}/callback/{{ .Name }}"
)

func (r *runner) Probe() (*probe, error) {

	log.WithField("pathway", r.P.Name).Debug("probe started")

	tkn := uuid.NewV4().String()

	r.C.Reporter.ProbeStarted(r.P.Name)

	responseURL, err := r.C.buildResponseURL(r.P.ResponseURLTemplate, r.P.Name, tkn)
	if err != nil {
		r.C.Reporter.ProbeFinished(Report{
			Pathway:   r.P.Name,
			Result:    ProbeNonStarter,
			Message:   fmt.Sprintf("cannot build response URL: %v", err),
			Timestamp: time.Now(),
		})
		return nil, err
	}

	var client = &http.Client{Timeout: time.Duration(r.P.Timeouts.Request)}
	req, err := http.NewRequest(r.P.Method, r.P.Endpoint, strings.NewReader(r.P.Payload))
	if err != nil {
		r.C.Reporter.ProbeFinished(Report{
			Pathway:   r.P.Name,
			Result:    ProbeNonStarter,
			Message:   fmt.Sprintf("cannot create request: %v", err),
			Timestamp: time.Now(),
		})
		return nil, err
	}
	req.Header.Add(HeaderToken, tkn)
	req.Header.Add(HeaderURL, responseURL.String())

	// From this point onwards we're beyond the non-starter phase and thus no longer
	// return error. We have a probe now!.
	prb := r.registerProbe(tkn)

	var resp *http.Response
	maxRetries := r.C.Config.Retries
	for attempts := 0; attempts <= maxRetries; attempts++ {
		resp, err = client.Do(req)
		if err == nil {
			break
		}
		log.WithField("pathway", r.P.Name).Warnf("request failed in attempt %v (max %v) – %v", attempts, maxRetries, err)
		if attempts != maxRetries {
			time.Sleep(time.Duration(r.C.Config.RetryDelay))
		}
	}
	if err != nil {
		r.failProbeIfUnresolved(tkn, err.Error())
		return prb, nil
	}
	if resp.StatusCode != http.StatusOK {
		r.failProbeIfUnresolved(tkn, fmt.Sprintf("expected 200 status code, got %d", resp.StatusCode))
		return prb, nil
	}

	// give the others some time to respond to this probe
	go func() {
		time.Sleep(time.Duration(r.P.Timeouts.Response))
		r.failProbeIfUnresolved(tkn, "response timeout")
	}()

	return prb, nil
}

func (r *runner) registerProbe(tkn string) *probe {
	p := newProbe()

	r.mu.Lock()
	r.active[tkn] = p
	r.mu.Unlock()

	return p
}

func (r *runner) failProbeIfUnresolved(tkn, reason string) {
	r.mu.Lock()
	p, exists := r.active[tkn]
	if !exists {
		// probe was resolved earlier - we're done here
		r.mu.Unlock()
		return
	}
	dur := time.Since(p.Started)

	delete(r.active, tkn)
	r.mu.Unlock()

	rep := Report{
		Pathway:   r.P.Name,
		Result:    ProbeFailure,
		Message:   reason,
		Duration:  dur,
		Timestamp: time.Now(),
	}

	p.Done(rep)
	r.C.Reporter.ProbeFinished(rep)
}

func (r *runner) Answer(tkn string, message string, result ProbeResult) (ok bool) {
	r.mu.Lock()

	p, ok := r.active[tkn]
	if !ok {
		r.mu.Unlock()
		return false
	}
	delete(r.active, tkn)
	r.mu.Unlock()

	dur := time.Since(p.Started)
	rep := Report{
		Pathway:   r.P.Name,
		Result:    result,
		Duration:  dur,
		Message:   message,
		Timestamp: time.Now(),
	}

	p.Done(rep)
	r.C.Reporter.ProbeFinished(rep)

	return true
}

func newProbe() *probe {
	return &probe{
		Started: time.Now(),
		done:    sync.NewCond(&sync.Mutex{}),
	}
}

// probe is an active measurement on a pathway
type probe struct {
	Started time.Time

	result *Report
	done   *sync.Cond
}

func (p *probe) Done(report Report) {
	p.done.L.Lock()
	p.result = &report
	p.done.L.Unlock()

	p.done.Broadcast()
}

func (p *probe) Wait() Report {
	p.done.L.Lock()
	for p.result == nil {
		p.done.Wait()
	}

	r := *p.result
	p.done.L.Unlock()

	return r
}

// Cerc is the service itself - create with New()
type Cerc struct {
	Config   Options
	Reporter Reporter

	runners map[string]*runner
}

// Reporter gets notified when a probe has run
type Reporter interface {
	ProbeStarted(pathway string)
	ProbeFinished(report Report)
}

// Report reports the result of a probe
type Report struct {
	Pathway   string        `json:"pathway"`
	Result    ProbeResult   `json:"result"`
	Message   string        `json:"message,omitempty"`
	Duration  time.Duration `json:"duration,omitempty"`
	Timestamp time.Time     `json:"timestamp,omitempty"`
}

// ProbeResult indicates the success of a pathway probe
type ProbeResult string

const (
	// ProbeSuccess means the probe was successful, i.e. we received a callback
	ProbeSuccess ProbeResult = "success"
	// ProbeFailure means the probe was not successful, i.e. we did not receive a callback in time, or the callback indicated failure
	ProbeFailure ProbeResult = "failure"
	// ProbeNonStarter means the probe never made the call to the pathway endpoint
	ProbeNonStarter ProbeResult = "nonstarter"
)

// CompositeReporter forwards events to multiple reporter
type CompositeReporter struct {
	children []Reporter
}

// NewCompositeReporter creates a new composite reporter
func NewCompositeReporter(children ...Reporter) *CompositeReporter {
	return &CompositeReporter{children: children}
}

// ProbeStarted is called when a new probe was started
func (r *CompositeReporter) ProbeStarted(pathway string) {
	for _, cr := range r.children {
		cr.ProbeStarted(pathway)
	}
}

// ProbeFinished is called when the probe has finished
func (r *CompositeReporter) ProbeFinished(report Report) {
	for _, cr := range r.children {
		cr.ProbeFinished(report)
	}
}

// Start creates a new cerc instance after validating its configuration
func Start(cfg Options, rep Reporter, mux *http.ServeMux) (c *Cerc, err error) {
	cfg.fillInDefaults()
	err = cfg.validate()
	if err != nil {
		return nil, err
	}

	c = &Cerc{
		Config:   cfg,
		Reporter: rep,
	}
	c.routes(mux)
	// wait that server is ready otherwise the first run could fail
	waitForServer(*c)
	c.run()

	return c, nil
}

func waitForServer(c Cerc) {

	var url string
	urlFallback := false

	if len(c.Config.Pathways) > 0 {
		// just checking the first pathway, expecting that others work as well when the first one works
		firstPathway := c.Config.Pathways[0]
		fullurl, err := c.buildResponseURL(firstPathway.ResponseURLTemplate, firstPathway.Name, "tkn")
		if err == nil {
			url = fullurl.String()
		} else {
			log.Warn("could not build response URL of first pathway ", err)
			urlFallback = true
		}
	} else {
		urlFallback = true
	}

	if urlFallback {
		url = c.Config.Address
		if strings.HasPrefix(url, ":") {
			url = "localhost" + url
		}
		scheme := "https"
		if c.Config.HTTPS.Cert == "" || c.Config.HTTPS.Key == "" {
			scheme = "http"
		}
		url = scheme + "://" + url + "/callback/"
	}

	log.Debug("waiting for server on ", url)

	expectedStatus := http.StatusUnauthorized

	for {
		resp, err := http.Get(url)
		if err != nil {
			time.Sleep(time.Second)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode != expectedStatus {
			time.Sleep(time.Second)
			continue
		}
		break
	}

	log.Debug("server is listening")
}

func (c *Cerc) routes(mux *http.ServeMux) {
	mux.Handle("/selftest/positive", &Receiver{})
	mux.Handle("/selftest/resp-timeout", &Receiver{
		Responder: func(url, tkn string) error {
			go func() {
				time.Sleep(1 * time.Second)
				defaultResponder(url, tkn)
			}()
			return nil
		},
	})

	mux.HandleFunc("/callback/", c.callback)
	mux.HandleFunc("/trigger/", c.trigger)
}

func (c *Cerc) run() {
	c.runners = make(map[string]*runner)
	for _, pth := range c.Config.Pathways {
		r := newRunner(c, pth)
		c.runners[pth.Name] = r

		if !pth.TriggerOnly {
			go r.Run()
		}
	}
}

func (c *Cerc) callback(resp http.ResponseWriter, req *http.Request) {
	authUser, token, ok := req.BasicAuth()
	if !ok {
		http.Error(resp, "unauthorized", http.StatusUnauthorized)
		return
	}
	if authUser != "Bearer" {
		http.Error(resp, "forbidden", http.StatusForbidden)
		return
	}

	name := strings.TrimPrefix(req.URL.Path, "/callback/")
	runner, ok := c.runners[name]
	if !ok {
		http.Error(resp, "no pathway named "+name, http.StatusNotFound)
		return
	}

	body, _ := ioutil.ReadAll(req.Body)
	resultParam := strings.TrimSpace(req.URL.Query().Get("result"))
	var result ProbeResult
	if len(resultParam) == 0 || resultParam == string(ProbeSuccess) {
		result = ProbeSuccess
	} else {
		result = ProbeFailure
	}

	ok = runner.Answer(token, string(body), result)
	if !ok {
		http.Error(resp, "forbidden", http.StatusForbidden)
		return
	}

	resp.WriteHeader(http.StatusOK)
}

func (c *Cerc) trigger(resp http.ResponseWriter, req *http.Request) {
	if c.Config.Auth != nil {
		authUser, authPwd, ok := req.BasicAuth()
		if !ok {
			http.Error(resp, "unauthorized", http.StatusUnauthorized)
			return
		}

		if authUser != c.Config.Auth.Username || authPwd != c.Config.Auth.Password {
			http.Error(resp, "forbidden", http.StatusForbidden)
			return
		}
	}

	name := strings.TrimPrefix(req.URL.Path, "/trigger/")
	runner, ok := c.runners[name]
	if !ok {
		http.Error(resp, "no pathway named "+name, http.StatusNotFound)
		return
	}

	prb, err := runner.Probe()
	if err != nil {
		// TODO: log
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte(err.Error()))
		return
	}

	rep := prb.Wait()

	resp.WriteHeader(http.StatusOK)
	err = json.NewEncoder(resp).Encode(rep)
	if err != nil {
		resp.Write([]byte(err.Error()))
	}
}

func (c *Cerc) buildResponseURL(ptpl, name, tkn string) (url *url.URL, err error) {
	if ptpl == "" {
		ptpl = c.Config.ResponseURLTemplate
	}
	tpl, err := template.New("url").Parse(ptpl)
	if err != nil {
		return nil, err
	}

	addr := c.Config.Address
	if strings.HasPrefix(addr, ":") {
		host, err := os.Hostname()
		if err != nil {
			return nil, err
		}

		addr = host + addr
	}
	scheme := "https"
	if c.Config.HTTPS.Cert == "" || c.Config.HTTPS.Key == "" {
		scheme = "http"
	}
	data := map[string]string{
		"Address": addr,
		"Name":    name,
		"Token":   tkn,
		"Scheme":  scheme,
	}

	var out bytes.Buffer
	err = tpl.Execute(&out, data)
	if err != nil {
		return nil, err
	}

	return url.Parse(out.String())
}
