package main

import (
	"context"
	"encoding/base64"
	"flag"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"

	"github.com/fatih/color"
	gp "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gliderlabs/ssh"
	log "github.com/sirupsen/logrus"
	"github.com/urfave/cli/v2"
)

var (
	gitpodServer = flag.String("server", "", "websocket address of the Gitpod server to talk to")
	token        = flag.String("token", "", "token to use when connecting to the Gitpod server")

	keyServerConn = struct{}{}
)

func main() {
	flag.Parse()

	server := ssh.Server{
		Addr: ":2222",
		Handler: func(s ssh.Session) {
			srv, err := gp.ConnectToServer(*gitpodServer, gp.ConnectToServerOpts{
				Context: s.Context(),
				Token:   *token,
				Log:     log.WithField("user", s.User()),
			})
			if err != nil {
				log.WithError(err).Error("cannot connect to upstream Gitpod server")
				return
			}
			defer srv.Close()

			app := cli.App{
				Name:        "gitpod",
				HelpName:    "gitpod",
				Description: "CLI for interacting with Gitpod",
				Usage:       "CLI for interacting with Gitpod",
				Writer:      s,
				Before: func(c *cli.Context) error {
					logo, _ := base64.StdEncoding.DecodeString("ICAgICAgICAgICAuJ14iIl4uICAgICAgICAgICAgCiAgICAgICAgLmAsLCwsLCwsLC4gICAgICAgICAgIAogICAgLiciOjo6OjosLCwsLGAgICAgICAgICAgICAKIC5gOjs7Ozs6Ojo6OixgJyAgICAgICAgICAgICAgCi47SUk7Ozs7OzsiYC4gICAgICAgIC5gIiwsLF4nIAo7bGxJSUk7XicgICAgICAgIC4nXiwsLCwsLCwsLGAKISEhbGxsYCAgICAgICAuYCw6Ojo6Ojo6LCwsLCwsCmlpaSEhIWAgICAgIGA7Ozs7Ozs7Ojo6Ojo6OiwsLAo+PmlpaWlgICAgIC5sSUlJOzs7OyInLic6Ojo6OjoKPDw+Pj5pYCAgICAgYDpsbDpeLiAgICAnOzs6Ojo6Cn5+PDw8PmAgICAgICAgICAgICAgICAgYDs7Ozs7OgohK35+fjw8OmAuICAgICAgICAgIC5gLElJSTs7OywKLjwrKyt+fn48PCEiJyAgICAnIkkhIWxsbElJSTouCiAgYEkrKyt+fn5+PDw+Ojo+PmlpaSEhISFsLGAgIAogICAgIGAsPCsrK35+fjw8PD4+Pj5pbCInICAgICAKICAgICAgICAuXmwrKyt+fn48PDteLiAgICAgICAgCg==")
					fmt.Fprintf(s, "\n%s\n", color.YellowString(string(logo)))
					return nil
				},
				Commands: []*cli.Command{
					{
						Name: "ls",
						Action: func(c *cli.Context) error {
							listWorkspaces(s.Context(), c, srv, s)
							return nil
						},
					},
					{
						Name:  "create",
						Usage: "<context-url>",
						Action: func(c *cli.Context) error {
							createWorkspace(s.Context(), c, srv, s)
							return nil
						},
					},
					{
						Name:  "start",
						Usage: "<workspace-id>",
						Action: func(c *cli.Context) error {
							startWorkspace(s.Context(), c, srv, s)
							return nil
						},
					},
					{
						Name:  "open",
						Usage: "<workspace-id>",
						Action: func(c *cli.Context) error {
							openWorkspace(s.Context(), c, srv, s)
							return nil
						},
					},
					{
						Name:  "stop",
						Usage: "<workspace-id>",
						Action: func(c *cli.Context) error {
							stopWorkspace(s.Context(), c, srv, s)
							return nil
						},
					},
				},
			}

			args := []string{"gitpod"}
			if rc := s.RawCommand(); rc != "" {
				args = append(args, strings.Fields(rc)...)
			}
			app.Run(args)

			// srv := s.Context().Value(keyServerConn).(*gp.APIoverJSONRPC)

		},
		// PasswordHandler: func(ctx ssh.Context, password string) bool {
		// 	if password == "" && *token != "" {
		// 		password = *token
		// 	}
		// 	srv, err := gp.ConnectToServer(*gitpodServer, gp.ConnectToServerOpts{
		// 		Context: ctx,
		// 		Token:   password,
		// 		Log:     log.WithField("user", ctx.User()),
		// 	})
		// 	if err != nil {
		// 		log.WithError(err).Error("cannot connect to upstream Gitpod server")
		// 		return false
		// 	}
		// 	ctx.SetValue(keyServerConn, srv)
		// 	return true
		// },
	}

	log.Fatal(server.ListenAndServe())
}

func openWorkspace(ctx context.Context, c *cli.Context, srv gp.APIInterface, out io.Writer) {
	if !c.Args().Present() {
		cli.ShowCommandHelp(c, "open")
		return
	}
	workspaceID := c.Args().First()

	ws, err := srv.GetWorkspace(ctx, workspaceID)
	if err != nil {
		fmt.Fprintf(out, "ERROR: %v\n", err)
		return
	}
	if ws.LatestInstance.Status.Phase != "running" {
		fmt.Fprintf(out, "ERROR: workspace is not running\n")
		return
	}
	ownerToken, err := srv.GetOwnerToken(ctx, workspaceID)
	if err != nil {
		fmt.Fprintf(out, "ERROR: %v\n", err)
		return
	}

	fmt.Fprintf(out, workspaceSSHCommand(workspaceID, ownerToken, ws.LatestInstance.IdeURL))
}

func listWorkspaces(ctx context.Context, c *cli.Context, srv gp.APIInterface, out io.Writer) {
	wss, err := srv.GetWorkspaces(ctx, &gp.GetWorkspacesOptions{
		Limit: 10,
	})
	if err != nil {
		fmt.Fprintf(out, "ERROR: %v\n", err)
		return
	}

	tw := tabwriter.NewWriter(out, 8, 4, 0, ' ', 0)
	defer tw.Flush()

	fmt.Fprintf(tw, "\tID\tDescription\tContext URL\n")
	for _, ws := range wss {
		status := getPhaseColor(ws.LatestInstance)
		fmt.Fprintf(tw, "%s \t%s\t%s\t%s\n", status, ws.Workspace.ID, ws.Workspace.Description, ws.Workspace.ContextURL)
	}
}

func getPhaseColor(instance *gp.WorkspaceInstance) string {
	if instance == nil {
		return color.RedString("██")
	} else if instance.Status.Phase == "running" {
		return color.GreenString("██")
	} else if instance.Status.Phase == "stopped" {
		return color.WhiteString("██")
	} else {
		return color.YellowString("██")
	}
}

func createWorkspace(ctx context.Context, c *cli.Context, srv gp.APIInterface, out io.Writer) {
	if !c.Args().Present() {
		cli.ShowCommandHelp(c, "create")
		return
	}

	contextURL := c.Args().First()
	fmt.Fprintf(out, "starting workspace for %s\n", contextURL)
	res, err := srv.CreateWorkspace(ctx, &gp.CreateWorkspaceOptions{
		ContextURL: contextURL,
		Mode:       "force-new",
	})
	if err != nil {
		fmt.Fprintf(out, "ERROR: %v\n", err)
		return
	}
	watchWorkspace(ctx, out, srv, res.CreatedWorkspaceID, false)

	return
}

func watchWorkspace(ctx context.Context, out io.Writer, srv gp.APIInterface, workspaceID string, stopping bool) {
	updates, err := srv.InstanceUpdates(ctx, "")
	if err != nil {
		fmt.Fprintf(out, "ERROR: %v\n", err)
		return
	}

	var (
		status    *gp.WorkspaceInstance
		lastPhase string
	)
updateLoop:
	for {
		select {
		case <-ctx.Done():
			return
		case status = <-updates:
			if status.WorkspaceID != workspaceID {
				continue
			}

			if lastPhase != status.Status.Phase {
				fmt.Fprintf(out, "%s %s: %s\n", getPhaseColor(status), workspaceID, status.Status.Phase)
			}
			lastPhase = status.Status.Phase

			if status.Status.Phase == "running" && !stopping {
				break updateLoop
			} else if status.Status.Phase == "stopped" {
				fmt.Fprintf(out, "workspace has stopped\n")
				return
			}
		}
	}

	tkn, err := srv.GetOwnerToken(ctx, status.WorkspaceID)
	if err != nil {
		fmt.Fprintf(out, "ERROR: %v\n", err)
		return
	}

	fmt.Fprintf(out, workspaceSSHCommand(status.WorkspaceID, tkn, status.IdeURL))
}

func workspaceSSHCommand(workspaceID, ownerToken, url string) string {
	segs := strings.Split(strings.TrimPrefix(url, "https://"), ".")
	url = "ssh." + strings.Join(segs[1:], ".")
	return fmt.Sprintf("workspace is running\nLogin using:\n\n\tsshpass -p %s ssh -o \"StrictHostKeyChecking no\" %s@%s\n", ownerToken, workspaceID, url)
}

func startWorkspace(ctx context.Context, c *cli.Context, srv gp.APIInterface, out io.Writer) {
	if !c.Args().Present() {
		cli.ShowCommandHelp(c, "start")
		return
	}

	workspaceID := c.Args().First()
	_, err := srv.StartWorkspace(ctx, workspaceID, &gp.StartWorkspaceOptions{
		ForceDefaultImage: false,
	})
	if err != nil {
		fmt.Fprintf(out, "ERROR: %v\n", err)
		return
	}

	watchWorkspace(ctx, out, srv, workspaceID, false)
}

func stopWorkspace(ctx context.Context, c *cli.Context, srv gp.APIInterface, out io.Writer) {
	if !c.Args().Present() {
		cli.ShowCommandHelp(c, "stop")
		return
	}

	workspaceID := c.Args().First()
	err := srv.StopWorkspace(ctx, workspaceID)
	if err != nil {
		fmt.Fprintf(out, "ERROR: %v\n", err)
		return
	}

	watchWorkspace(ctx, out, srv, workspaceID, true)
}
