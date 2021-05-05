// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

/*
var defaultTemplate = `{{.Id}} {{.Phase}}: {{.Message}}{{"\n"}}`

// clientStartCmd starts a new workspace
var clientWatchCmd = &cobra.Command{
	Use:   "watch",
	Short: "observe for workspace status changes",
	Run: func(cmd *cobra.Command, args []string) {
		tpl := template.New("tpl")
		tpl, err := tpl.Parse(defaultTemplate)
		if err != nil {
			log.WithError(err).Fatal("cannot parse template")
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		conn, client, err := getWorkspacesClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		sub, err := client.Subscribe(ctx, &api.SubscribeRequest{})
		if err != nil {
			log.WithError(err).Fatal("cannot subscribe")
		}
		rcvChan := make(chan *api.WorkspaceStatus)
		go func() {
			for {
				update, err := sub.Recv()
				if err != nil {
					if err != io.EOF {
						log.WithError(err).Warn("error while receiving updates")
					}

					return
				}

				sts, ok := update.Payload.(*api.SubscribeResponse_Status)
				if !ok {
					continue
				}

				rcvChan <- sts.Status
			}
		}()

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("Listening for status updates. Stop with SIGINT or CTRL+C")

		for {
			select {
			case <-sigChan:
				log.Info("Received SIGINT - shutting down")
				return
			case sts := <-rcvChan:
				err = tpl.Execute(os.Stdout, sts)
				if err != nil {
					log.WithError(err).WithField("status", sts).Info("status update")
				}
			}
		}
	},
}
*/
func init() {
	// TODO: re-enable this once we're not talking over messagebus anymore
	// workspacesCmd.AddCommand(workspacesWatchCmd)
}
