package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

func main() {
	rootCmd.Execute()
}

var (
	workspacesFile string
	projectsFile   string
	teamsFile      string
)

func init() {
	rootCmd.PersistentFlags().StringVar(&workspacesFile, "workspaces-file", "", "path to workspaces file")
	rootCmd.PersistentFlags().StringVar(&projectsFile, "projects-file", "", "path to projects file")
	rootCmd.PersistentFlags().StringVar(&teamsFile, "teams-file", "", "path to teams file")

	rootCmd.AddCommand(transformCmd)
}

var (
	rootCmd = &cobra.Command{
		Use:   "cobra-cli",
		Short: "A generator for Cobra based Applications",
		Long: `Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	}

	transformCmd = &cobra.Command{
		Use: "transform",
		RunE: func(cmd *cobra.Command, args []string) error {
			return transform(workspacesFile, projectsFile, teamsFile)
		},
	}
)

type Workspace struct {
	ID      string `json:"id"`
	OwnerID string `json:"ownerId"`
}

func (w *Workspace) ToOwnerRelationship() string {
	return fmt.Sprintf("workspace:%s#owner@user:%s", w.ID, w.OwnerID)
}

func transform(wsFilePath, projFilePath, teamsFilePath string) error {
	var relationships []string

	if wsFilePath != "" {
		workspaces, err := readWS(wsFilePath)
		if err != nil {
			return err
		}

		for _, w := range workspaces {
			relationships = append(relationships, w.ToOwnerRelationship())
		}
	}

	fmt.Fprintf(os.Stdout, "relationships: |-\n")

	for _, r := range relationships {
		fmt.Fprintf(os.Stdout, "\t%s\n", r)
	}

	return nil
}

func readWS(filePath string) ([]Workspace, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}

	defer f.Close()

	var results []Workspace

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var ws Workspace
		if err := json.Unmarshal(scanner.Bytes(), &ws); err != nil {
			return nil, err
		}

		results = append(results, ws)
	}

	return results, nil
}
