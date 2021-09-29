// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/logs"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/terminal"
)

type tasksSubscription struct {
	updates chan []*api.TaskStatus
	Close   func() error
}

func (sub *tasksSubscription) Updates() <-chan []*api.TaskStatus {
	return sub.updates
}

const maxSubscriptions = 10

func (tm *tasksManager) Subscribe() *tasksSubscription {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if len(tm.subscriptions) > maxSubscriptions {
		return nil
	}

	sub := &tasksSubscription{updates: make(chan []*api.TaskStatus, 5)}
	sub.Close = func() error {
		tm.mu.Lock()
		defer tm.mu.Unlock()

		// We can safely close the channel here even though we're not the
		// producer writing to it, because we're holding mu.
		close(sub.updates)
		delete(tm.subscriptions, sub)

		return nil
	}
	tm.subscriptions[sub] = struct{}{}

	// makes sure that no updates can happen between clients receiving an initial status and subscribing
	sub.updates <- tm.getStatus()
	return sub
}

type task struct {
	api.TaskStatus
	config      TaskConfig
	command     string
	successChan chan taskSuccess
	title       string
	lastOutput  string
}

type headlessTaskProgressReporter interface {
	write(data string, task *task, terminal *terminal.Term)
	done(success taskSuccess)
}

type taskSuccess string

func (t taskSuccess) Failed() bool { return t != "" }

var taskSuccessful taskSuccess = ""

func (t taskSuccess) Fail(msg string) taskSuccess {
	res := string(t)
	if res != "" {
		res += "; "
	}
	res += msg
	return taskSuccess(res)
}

func taskFailed(msg string) taskSuccess {
	return taskSuccessful.Fail(msg)
}

type tasksManager struct {
	config          *Config
	storeLocation   string
	contentSource   csapi.WorkspaceInitSource
	tasks           []*task
	subscriptions   map[*tasksSubscription]struct{}
	mu              sync.RWMutex
	ready           chan struct{}
	terminalService *terminal.MuxTerminalService
	contentState    ContentState
	reporter        headlessTaskProgressReporter
}

func newTasksManager(config *Config, terminalService *terminal.MuxTerminalService, contentState ContentState, reporter headlessTaskProgressReporter) *tasksManager {
	return &tasksManager{
		config:          config,
		terminalService: terminalService,
		contentState:    contentState,
		reporter:        reporter,
		subscriptions:   make(map[*tasksSubscription]struct{}),
		ready:           make(chan struct{}),
		storeLocation:   logs.TerminalStoreLocation,
	}
}

func (tm *tasksManager) Status() []*api.TaskStatus {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	return tm.getStatus()
}

// getStatus produces an API compatible task status list.
// Callers are expected to hold mu.
func (tm *tasksManager) getStatus() []*api.TaskStatus {
	status := make([]*api.TaskStatus, 0, len(tm.tasks))
	for _, t := range tm.tasks {
		status = append(status, &t.TaskStatus)
	}
	return status
}

func (tm *tasksManager) updateState(doUpdate func() (changed bool)) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	changed := doUpdate()
	if !changed {
		return
	}

	updates := tm.getStatus()
	for sub := range tm.subscriptions {
		select {
		case sub.updates <- updates:
		case <-time.After(5 * time.Second):
			log.Error("tasks subscription droped out")
			sub.Close()
		}
	}
}

func (tm *tasksManager) setTaskState(t *task, newState api.TaskState) {
	tm.updateState(func() bool {
		if t.State == newState {
			return false
		}

		t.State = newState
		return true
	})
}

func (tm *tasksManager) init(ctx context.Context) {
	defer close(tm.ready)

	tasks, err := tm.config.getGitpodTasks()
	if err != nil {
		log.WithError(err).Error()
		return
	}
	if tasks == nil && tm.config.isHeadless() {
		return
	}
	if tasks == nil {
		tasks = &[]TaskConfig{{}}
	}

	select {
	case <-ctx.Done():
		return
	case <-tm.contentState.ContentReady():
	}

	contentSource, _ := tm.contentState.ContentSource()
	tm.contentSource = contentSource

	for i, config := range *tasks {
		id := strconv.Itoa(i)
		presentation := &api.TaskPresentation{}
		title := ""
		if config.Name != nil {
			presentation.Name = *config.Name
			title = *config.Name
		} else {
			presentation.Name = tm.terminalService.DefaultWorkdir
		}
		if config.OpenIn != nil {
			presentation.OpenIn = *config.OpenIn
		}
		if config.OpenMode != nil {
			presentation.OpenMode = *config.OpenMode
		}
		task := &task{
			TaskStatus: api.TaskStatus{
				Id:           id,
				State:        api.TaskState_opening,
				Presentation: presentation,
			},
			config:      config,
			successChan: make(chan taskSuccess, 1),
			title:       title,
		}
		task.command = getCommand(task, tm.config.isHeadless(), tm.contentSource, tm.storeLocation)
		if tm.config.isHeadless() && task.command == "exit" {
			task.State = api.TaskState_closed
			task.successChan <- taskSuccessful
		}
		tm.tasks = append(tm.tasks, task)
	}
}

func (tm *tasksManager) Run(ctx context.Context, wg *sync.WaitGroup, successChan chan taskSuccess) {
	defer wg.Done()
	defer log.Debug("tasksManager shutdown")

	tm.init(ctx)

	for _, t := range tm.tasks {
		if t.State == api.TaskState_closed {
			continue
		}
		taskLog := log.WithField("command", t.command)
		taskLog.Info("starting a task terminal...")
		openRequest := &api.OpenTerminalRequest{}
		if t.config.Env != nil {
			openRequest.Env = make(map[string]string, len(*t.config.Env))
			for key, value := range *t.config.Env {
				v, err := json.Marshal(value)
				if err != nil {
					taskLog.WithError(err).WithField("key", key).Error("cannot marshal env var")
				} else {
					openRequest.Env[key] = string(v)
				}
			}
		}
		var readTimeout time.Duration
		if !tm.config.isHeadless() {
			readTimeout = 5 * time.Second
		}
		resp, err := tm.terminalService.OpenWithOptions(ctx, openRequest, terminal.TermOptions{
			ReadTimeout: readTimeout,
			Title:       t.title,
		})
		if err != nil {
			taskLog.WithError(err).Error("cannot open new task terminal")
			t.successChan <- taskFailed("cannot open new task terminal")
			tm.setTaskState(t, api.TaskState_closed)
			continue
		}

		taskLog = taskLog.WithField("terminal", resp.Terminal.Alias)
		term, ok := tm.terminalService.Mux.Get(resp.Terminal.Alias)
		if !ok {
			taskLog.Error("cannot find a task terminal")
			t.successChan <- taskFailed("cannot find a task terminal")
			tm.setTaskState(t, api.TaskState_closed)
			continue
		}

		taskLog = taskLog.WithField("pid", term.Command.Process.Pid)
		taskLog.Info("task terminal has been started")
		tm.updateState(func() bool {
			t.Terminal = resp.Terminal.Alias
			t.State = api.TaskState_running
			return true
		})

		go func(t *task, term *terminal.Term) {
			state, err := term.Wait()
			if state != nil {
				if state.Success() {
					t.successChan <- taskSuccessful
				} else {
					t.successChan <- taskFailed(state.String())
				}
			} else if err != nil && strings.Contains(err.Error(), "no child process") {
				// our own reaper broke Go's child process handling
				t.successChan <- taskSuccessful
			} else {
				msg := "cannot wait for task"
				if err != nil {
					msg = err.Error()
				}

				t.successChan <- taskFailed(fmt.Sprintf("%s: %s", msg, t.lastOutput))
			}
			taskLog.Info("task terminal has been closed")
			tm.setTaskState(t, api.TaskState_closed)
		}(t, term)

		tm.watch(t, term)

		if t.command != "" {
			term.PTY.Write([]byte(t.command + "\n"))
		}
	}

	var success taskSuccess
	for _, task := range tm.tasks {
		select {
		case <-ctx.Done():
			success = taskFailed(ctx.Err().Error())
		case taskResult := <-task.successChan:
			if taskResult.Failed() {
				success = success.Fail(string(taskResult))
			}
		}
	}

	if tm.config.isHeadless() && tm.reporter != nil {
		tm.reporter.done(success)
	}
	successChan <- success
}

func getCommand(task *task, isHeadless bool, contentSource csapi.WorkspaceInitSource, storeLocation string) string {
	commands := getCommands(task, isHeadless, contentSource, storeLocation)
	command := composeCommand(composeCommandOptions{
		commands: commands,
		format:   "{\n%s\n}",
		sep:      " && ",
	})

	if isHeadless {
		// it's important that prebuild tasks exit eventually
		// also, we need to save the log output in the workspace
		if strings.TrimSpace(command) == "" {
			return "exit"
		}
		return command + "; exit"
	}

	histfileCommand := getHistfileCommand(task, commands, contentSource, storeLocation)
	if strings.TrimSpace(command) == "" {
		return histfileCommand
	}
	if histfileCommand == "" {
		return command
	}
	return histfileCommand + "; " + command
}

func getHistfileCommand(task *task, commands []*string, contentSource csapi.WorkspaceInitSource, storeLocation string) string {
	histfileCommands := commands
	if contentSource == csapi.WorkspaceInitFromPrebuild {
		histfileCommands = []*string{task.config.Before, task.config.Init, task.config.Prebuild, task.config.Command}
	}
	histfileContent := composeCommand(composeCommandOptions{
		commands: histfileCommands,
		format:   "%s\r\n",
	})
	if strings.TrimSpace(histfileContent) == "" {
		return ""
	}

	histfile := storeLocation + "/cmd-" + task.Id
	err := os.WriteFile(histfile, []byte(histfileContent), 0644)
	if err != nil {
		log.WithField("histfile", histfile).WithError(err).Error("cannot write histfile")
		return ""
	}

	// the space at beginning of the HISTFILE command prevents the HISTFILE command itself from appearing in
	// the bash history.
	return " HISTFILE=" + histfile + " history -r"
}

func getCommands(task *task, isHeadless bool, contentSource csapi.WorkspaceInitSource, storeLocation string) []*string {
	if isHeadless {
		// prebuild
		return []*string{task.config.Before, task.config.Init, task.config.Prebuild}
	}
	if contentSource == csapi.WorkspaceInitFromPrebuild {
		// prebuilt
		prebuildLogFileName := prebuildLogFileName(task, storeLocation)
		legacyPrebuildLogFileName := logs.LegacyPrebuildLogFileName(task.Id)
		printlogs := "[ -r " + legacyPrebuildLogFileName + " ] && cat " + legacyPrebuildLogFileName + "; [ -r " + prebuildLogFileName + " ] && cat " + prebuildLogFileName + "; true"
		return []*string{task.config.Before, &printlogs, task.config.Command}
	}
	if contentSource == csapi.WorkspaceInitFromBackup {
		// restart
		return []*string{task.config.Before, task.config.Command}
	}
	// init
	return []*string{task.config.Before, task.config.Init, task.config.Command}
}

func prebuildLogFileName(task *task, storeLocation string) string {
	return logs.PrebuildLogFileName(storeLocation, task.Id)
}

func (tm *tasksManager) watch(task *task, terminal *terminal.Term) {
	if !tm.config.isHeadless() {
		return
	}

	var (
		terminalLog = log.WithField("pid", terminal.Command.Process.Pid)
		stdout      = terminal.Stdout.Listen()
		start       = time.Now()
	)
	go func() {
		defer stdout.Close()

		var (
			fileName    = prebuildLogFileName(task, tm.storeLocation)
			oldFileName = fileName + "-old"
		)
		if _, err := os.Stat(fileName); err == nil {
			// If the file already exists (from a parent prebuild), temporarily move it so that it doesn't get truncated.
			// On the off chance that renaming fails here, we silently ignore that -- the new prebuild logs simply won't reflect
			// the older logs and elapsed time (`importParentLogAndGetDuration` is always safe thanks to its initial `os.Stat`).
			_ = os.Rename(fileName, oldFileName)
		}
		file, err := os.Create(fileName)
		var fileWriter *bufio.Writer
		if err != nil {
			terminalLog.WithError(err).Error("cannot create a prebuild log file")
			fileWriter = bufio.NewWriter(io.Discard)
		} else {
			defer file.Close()
			terminalLog.Info("Writing build output to " + fileName)
			fileWriter = bufio.NewWriter(file)
			defer fileWriter.Flush()
		}
		// Import any parent prebuild logs and parse their total duration if available
		parentElapsed := importParentLogAndGetDuration(oldFileName, fileWriter)

		buf := make([]byte, 4096)
		for {
			n, err := stdout.Read(buf)
			if err == io.EOF {
				elapsed := time.Since(start)
				if parentElapsed > elapsed {
					elapsed = parentElapsed
				}
				duration := ""
				if elapsed >= 1*time.Minute {
					elapsedInMinutes := strconv.Itoa(int(elapsed.Minutes()))
					duration = "🎉 Well done on saving " + elapsedInMinutes + " minute"
					if elapsedInMinutes != "1" {
						duration += "s"
					}
					duration += "\r\n"
				}
				data := string(buf[:n])
				fileWriter.Write(buf[:n])
				if tm.reporter != nil {
					tm.reporter.write(data, task, terminal)
				}

				endMessage := "\r\n🤙 This task ran as a workspace prebuild\r\n" + duration + "\r\n"
				fileWriter.WriteString(endMessage)
				break
			}
			if err != nil {
				terminalLog.WithError(err).Error("cannot read from a task terminal")
				return
			}
			data := string(buf[:n])
			fileWriter.Write(buf[:n])
			if tm.reporter != nil {
				task.lastOutput = string(buf[:n])
				tm.reporter.write(data, task, terminal)
			}
		}
	}()
}

func importParentLogAndGetDuration(fn string, out io.Writer) time.Duration {
	if _, err := os.Stat(fn); err != nil {
		return 0
	}
	defer os.Remove(fn)

	file, err := os.Open(fn)
	if err != nil {
		return 0
	}
	defer file.Close()

	defer out.Write([]byte("♻️ Re-running task as an incremental workspace prebuild\r\n\r\n"))

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		l := scanner.Text()
		if strings.Contains(l, "🤙 This task ran as a workspace prebuild") {
			break
		}
		out.Write([]byte(l + "\n"))
	}
	if !scanner.Scan() {
		return 0
	}
	reg, err := regexp.Compile(`🎉 Well done on saving (\d+) minute`)
	if err != nil {
		return 0
	}
	res := reg.FindStringSubmatch(scanner.Text())
	if res == nil {
		return 0
	}
	elapsedInMinutes, err := strconv.Atoi(res[1])
	if err != nil {
		return 0
	}
	return time.Duration(elapsedInMinutes) * time.Minute
}

type composeCommandOptions struct {
	commands []*string
	format   string
	sep      string
}

func composeCommand(options composeCommandOptions) string {
	var commands []string
	for _, command := range options.commands {
		if command != nil && strings.TrimSpace(*command) != "" {
			commands = append(commands, fmt.Sprintf(options.format, *command))
		}
	}
	return strings.Join(commands, options.sep)
}
