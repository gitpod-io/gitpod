// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/iwh"
	"github.com/gitpod-io/gitpod/supervisor/pkg/terminal"
)

type runContext struct {
	contentSource csapi.WorkspaceInitSource
	headless      bool
	tasks         []*task
}

type tasksSubscription struct {
	updates chan []*api.TaskStatus
	Close   func() error
}

func (sub *tasksSubscription) Updates() <-chan []*api.TaskStatus {
	return sub.updates
}

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

	return sub
}

type task struct {
	api.TaskStatus
	config       TaskConfig
	command      string
	prebuildChan chan bool
}

type tasksManager struct {
	config          *Config
	tasks           map[string]*task
	subscriptions   map[*tasksSubscription]struct{}
	mu              sync.RWMutex
	ready           chan struct{}
	terminalService *terminal.MuxTerminalService
	contentState    iwh.ContentState
}

func newTasksManager(config *Config, terminalService *terminal.MuxTerminalService, contentState iwh.ContentState) *tasksManager {
	return &tasksManager{
		config:          config,
		terminalService: terminalService,
		contentState:    contentState,
		tasks:           make(map[string]*task),
		subscriptions:   make(map[*tasksSubscription]struct{}),
		ready:           make(chan struct{}),
	}
}

func (tm *tasksManager) getStatus() []*api.TaskStatus {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	i := 0
	status := make([]*api.TaskStatus, len(tm.tasks))
	for _, task := range tm.tasks {
		status[i] = &task.TaskStatus
		i++
	}
	return status
}

func (tm *tasksManager) updateState(doUpdate func() *task) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	updated := doUpdate()
	if updated == nil {
		return
	}
	updates := make([]*api.TaskStatus, 1)
	updates[0] = &updated.TaskStatus
	for sub := range tm.subscriptions {
		select {
		case sub.updates <- updates:
		default:
			log.Warn("cannot to push tasks update to a subscriber")
		}
	}
}

func (tm *tasksManager) setTaskState(t *task, newState api.TaskState) {
	tm.updateState(func() *task {
		if t.State == newState {
			return nil
		}
		t.State = newState
		return t
	})
}

func (tm *tasksManager) init(ctx context.Context) *runContext {
	defer close(tm.ready)

	tasks, err := tm.config.getGitpodTasks()
	if err != nil {
		log.WithError(err).Fatal()
		return nil
	}
	if tasks == nil {
		log.Info("no gitpod tasks found")
		return nil
	}

	select {
	case <-ctx.Done():
		return nil
	case <-tm.contentState.ContentReady():
	}

	contentSource, _ := tm.contentState.ContentSource()
	headless := tm.config.GitpodHeadless != nil && *tm.config.GitpodHeadless == "true"
	runContext := &runContext{
		contentSource: contentSource,
		headless:      headless,
		tasks:         make([]*task, 0),
	}

	for i, config := range *tasks {
		id := strconv.Itoa(i)
		presentation := &api.TaskPresentation{}
		if config.Name != nil {
			presentation.Name = *config.Name
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
			config: config,
		}
		task.command = task.getCommand(runContext)
		if task.command == "" {
			task.State = api.TaskState_closed
		} else {
			runContext.tasks = append(runContext.tasks, task)
		}
		tm.tasks[id] = task
	}
	return runContext
}

func (tm *tasksManager) Run(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()

	runContext := tm.init(ctx)
	if runContext == nil {
		return
	}
	if len(runContext.tasks) == 0 {
		log.Info("no gitpod tasks to run")
		return
	}

	for _, t := range runContext.tasks {
		taskLog := log.WithField("command", t.command)
		taskLog.Info("starting a task terminal...")
		openRequest := &api.OpenTerminalRequest{}
		if t.config.Env != nil {
			openRequest.Env = *t.config.Env
		}
		resp, err := tm.terminalService.Open(ctx, openRequest)
		if err != nil {
			taskLog.WithError(err).Fatal("cannot open new task terminal")
			tm.setTaskState(t, api.TaskState_closed)
			continue
		}

		taskLog = taskLog.WithField("terminal", resp.Alias)
		terminal, ok := tm.terminalService.Mux.Get(resp.Alias)
		if !ok {
			taskLog.Fatal("cannot find a task terminal")
			tm.setTaskState(t, api.TaskState_closed)
			continue
		}

		taskLog.Info("task terminal has been started")
		tm.updateState(func() *task {
			t.Terminal = resp.Alias
			t.State = api.TaskState_running
			return t
		})

		go func(t *task) {
			terminal.Command.Process.Wait()
			taskLog.Info("task terminal has been closed")
			tm.setTaskState(t, api.TaskState_closed)
		}(t)

		if runContext.headless {
			tm.watch(t, terminal)
		}
		terminal.PTY.Write([]byte(t.command + "\r\n"))
	}

	if runContext.headless {
		tm.report(ctx)
	}
}

func (task *task) getCommand(context *runContext) string {
	commands := task.getCommands(context)
	command := composeCommand(composeCommandOptions{
		commands: commands,
		format:   "{\r\n%s\r\n}",
		sep:      " && ",
	})

	if strings.TrimSpace(command) == "" {
		return ""
	}

	if context.headless {
		// it's important that prebuild tasks exit eventually
		// also, we need to save the log output in the workspace
		return command + "; exit"
	}

	histfile := "/workspace/.gitpod/cmd-" + task.Id
	histfileCommands := commands
	if context.contentSource == csapi.WorkspaceInitFromPrebuild {
		histfileCommands = []*string{task.config.Before, task.config.Init, task.config.Prebuild, task.config.Command}
	}
	err := ioutil.WriteFile(histfile, []byte(composeCommand(composeCommandOptions{
		commands: histfileCommands,
		format:   "%s\r\n",
	})), 0644)
	if err != nil {
		log.WithField("histfile", histfile).WithError(err).Fatal("cannot write histfile")
		return command
	}
	// the space at beginning of the HISTFILE command prevents the HISTFILE command itself from appearing in
	// the bash history.
	return " HISTFILE=" + histfile + " history -r; " + command
}

func (task *task) getCommands(context *runContext) []*string {
	if context.headless {
		// prebuild
		return []*string{task.config.Before, task.config.Init, task.config.Prebuild}
	}
	if context.contentSource == csapi.WorkspaceInitFromPrebuild {
		// prebuilt
		prebuildLogFileName := task.prebuildLogFileName()
		legacyPrebuildLogFileName := "/workspace/.prebuild-log-" + task.Id
		printlogs := "[ -r " + legacyPrebuildLogFileName + " ] && cat " + legacyPrebuildLogFileName + "; [ -r " + prebuildLogFileName + " ] && cat " + prebuildLogFileName + "; true"
		return []*string{task.config.Before, &printlogs, task.config.Command}
	}
	if context.contentSource == csapi.WorkspaceInitFromBackup {
		// restart
		return []*string{task.config.Before, task.config.Command}
	}
	// init
	return []*string{task.config.Before, task.config.Init, task.config.Command}

}

func (task *task) prebuildLogFileName() string {
	return "/workspace/.gitpod/prebuild-log-" + task.Id
}

func (tm *tasksManager) watch(task *task, terminal *terminal.Term) {
	var (
		workspaceLog = log.WithField("component", "workspace")
		stdout       = terminal.Stdout.Listen()
		start        = time.Now()
	)
	task.prebuildChan = make(chan bool)
	go func() {
		success := false
		defer func() {
			task.prebuildChan <- success
		}()

		fileName := task.prebuildLogFileName()
		file, err := os.Create(fileName)
		if err != nil {
			workspaceLog.WithError(err).Fatal("cannot create a prebuild log file")
			return
		}
		defer file.Close()

		fileWriter := bufio.NewWriter(file)

		workspaceLog.Info("Writing build output to " + fileName)

		buf := make([]byte, 4096)
		for {
			n, err := stdout.Read(buf)
			if err == io.EOF {
				elapsed := time.Since(start)
				duration := ""
				if elapsed >= 1*time.Minute {
					elapsedInMinutes := strconv.Itoa(int(elapsed.Minutes()))
					duration = "🎉 You just saved " + elapsedInMinutes + " minute"
					if elapsedInMinutes != "1" {
						duration += "s"
					}
					duration += " of watching your code build.\r\n"
				}
				data := string(buf[:n])
				fileWriter.Write(buf[:n])
				workspaceLog.WithField("type", "workspaceTaskOutput").WithField("data", data).Info()

				endMessage := "\r\n🍌 This task ran as part of a workspace prebuild.\r\n" + duration + "\r\n"
				fileWriter.WriteString(endMessage)
				workspaceLog.WithField("type", "workspaceTaskOutput").WithField("data", endMessage).Info()

				fileWriter.Flush()
				success = true
				break
			}
			if err != nil {
				workspaceLog.WithError(err).Fatal("cannot read from a task terminal")
				return
			}
			data := string(buf[:n])
			fileWriter.Write(buf[:n])
			workspaceLog.WithField("type", "workspaceTaskOutput").WithField("data", data).Info()
		}
	}()
}

func (tm *tasksManager) report(ctx context.Context) {
	workspaceLog := log.WithField("component", "workspace")
	ok := true
	for _, task := range tm.tasks {
		if task.prebuildChan != nil {
			select {
			case <-ctx.Done():
				return
			case prebuildOk := <-task.prebuildChan:
				if !prebuildOk {
					ok = false
				}
			}
		}
	}
	workspaceLog.WithField("type", "workspaceTaskOutput").WithField("data", "🚛 uploading prebuilt workspace").Info()
	if !ok {
		workspaceLog.WithField("type", "workspaceTaskFailed").WithField("error", "one of the tasks failed with non-zero exit code").Info()
		return
	}
	workspaceLog.WithField("type", "workspaceTaskDone").Info()
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
