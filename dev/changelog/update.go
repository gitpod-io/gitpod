// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
// Based on https://github.com/leodido/rn2md with kind permission from the author
package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/go-github/v38/github"
	logger "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

type UpdateOptions struct {
	Token         string
	ChangelogFile string
	Org           string
	Repo          string
	Branch        string
}

var opts = &UpdateOptions{}

var updateCommand = &cobra.Command{
	Use:   "update",
	Long:  "parses the latest entry from the existing changelog file, gets more recent PRs from GitHub and prepends their release note entries.",
	Short: "Generate markdown for your changelogs from release-note blocks.",
	Run: func(c *cobra.Command, args []string) {
		existingNotes, lastPrNumber, lastPrDate := ParseFile(opts.ChangelogFile)
		client := NewClient(opts.Token)
		notes, err := GetReleaseNotes(client, opts, lastPrNumber)
		if err != nil {
			logger.WithError(err).Fatal("error retrieving PRs")
		}
		if len(notes) == 0 {
			logger.Infof("No new PRs, changelog is up-to-date")
			return
		}
		logger.Infof("Adding %d release note entries", len(notes))
		WriteFile(opts.ChangelogFile, notes, existingNotes, lastPrDate)
	},
}

func init() {
	// Setup updateFlags before the command is initialized
	updateFlags := updateCommand.PersistentFlags()
	updateFlags.StringVarP(&opts.Org, "org", "o", opts.Org, "the github organization")
	updateFlags.StringVarP(&opts.Repo, "repo", "r", opts.Repo, "the github repository name")
	updateFlags.StringVarP(&opts.Branch, "branch", "b", "main", "the target branch you want to filter by the pull requests")
	updateFlags.StringVarP(&opts.ChangelogFile, "file", "f", "CHANGELOG.md", "the changelog file")
	updateFlags.StringVarP(&opts.Token, "token", "t", opts.Token, "a GitHub personal API token to perform authenticated requests")
	rootCommand.AddCommand(updateCommand)
}

var (
	noteLineRegexp = regexp.MustCompile(`[-*]\s.*\s\(\[#(\d*)\]\(`)
	dateLineRegexp = regexp.MustCompile(`## (\w* \d*)`)
)

func ParseFile(path string) (existingNotes []string, lastPrNumber int, lastPrDate time.Time) {
	lastPrNumber = 0
	lastPrDate = time.Unix(0, 0)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return
	}

	file, err := os.Open(path)
	if err != nil {
		logger.Fatal(err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		dateMatch := dateLineRegexp.FindStringSubmatch(scanner.Text())
		if len(dateMatch) > 1 && lastPrDate == time.Unix(0, 0) {
			lastPrDate, err = time.Parse("January 2006", dateMatch[1])
			if err != nil {
				logger.Warnf("Ignoring invalid date line %s", dateMatch[1])
			} else {
				logger.Infof("Last PR date %s", lastPrDate.Format("January 2006"))
			}
		}
		prMatch := noteLineRegexp.FindStringSubmatch(scanner.Text())
		if len(prMatch) > 1 && lastPrNumber == 0 {
			lastPrNumber, err = strconv.Atoi(prMatch[1])
			if err != nil {
				logger.Warnf("Ignoring invalid PR number %s", prMatch[1])
			} else {
				logger.Infof("Last PR number #%d", lastPrNumber)
			}
		}
		if lastPrNumber != 0 {
			existingNotes = append(existingNotes, scanner.Text())
		}
	}
	if err := scanner.Err(); err != nil {
		logger.Fatal(err)
	}
	return
}

// ReleaseNote ...

type ReleaseNote struct {
	Breaking    bool
	Description string
	URI         string
	Num         int
	Authors     map[string]Author
	MergedAt    time.Time
}

type Author struct {
	Login string
	URL   string
}

type void struct{}

var member void
var releaseNoteRegexp = regexp.MustCompile("(?s)```release-note(.+?)```")

const defaultGitHubBaseURI = "https://github.com"

// Get returns the list of release notes found for the given parameters.
func GetReleaseNotes(c *github.Client, opts *UpdateOptions, lastPrNr int) ([]ReleaseNote, error) {
	var (
		ctx          = context.Background()
		releaseNotes = []ReleaseNote{}
		processed    = make(map[int]void)
	)
	listingOpts := &github.PullRequestListOptions{
		State:     "closed",
		Base:      opts.Branch,
		Sort:      "updated",
		Direction: "desc",
		ListOptions: github.ListOptions{
			// All GitHub paginated queries start at page 1 !?
			// https://docs.github.com/en/rest/guides/traversing-with-pagination
			Page: 1,
		},
	}
	for {
		logger.Infof("Querying PRs from GitHub, page %d", listingOpts.ListOptions.Page)
		prs, response, err := c.PullRequests.List(ctx, opts.Org, opts.Repo, listingOpts)
		if _, ok := err.(*github.RateLimitError); ok {
			return nil, fmt.Errorf("hit rate limiting")
		}
		if err != nil {
			return nil, err
		}
		logger.Infof("Received %d PRs", len(prs))
		for _, p := range prs {
			num := p.GetNumber()
			if _, exists := processed[num]; exists {
				continue
			}
			processed[num] = member
			if num == lastPrNr {
				return releaseNotes, nil
			}

			isMerged, _, err := c.PullRequests.IsMerged(ctx, opts.Org, opts.Repo, num)
			if _, ok := err.(*github.RateLimitError); ok {
				return nil, fmt.Errorf("hit rate limiting")
			}
			if err != nil {
				return nil, fmt.Errorf("error detecting if PR %d is merged or not", num)
			}
			if !isMerged {
				// It means PR has been closed but not merged in
				continue
			}

			authors, err := GetAuthors(c, ctx, opts, num)
			if err != nil {
				return nil, fmt.Errorf("error getting authors of #%d", num)
			}
			res := releaseNoteRegexp.FindStringSubmatch(p.GetBody())
			if len(res) == 0 {
				// legacy mode for pre-changelog automation PRs
				rn := ReleaseNote{
					Breaking:    false,
					Description: p.GetTitle(),
					URI:         fmt.Sprintf("%s/%s/%s/pull/%d", defaultGitHubBaseURI, opts.Org, opts.Repo, num),
					Num:         num,
					Authors:     authors,
					MergedAt:    p.GetMergedAt(),
				}
				releaseNotes = append(releaseNotes, rn)
				continue
			}
			note := strings.TrimSpace(res[1])
			if note == "NONE" || note == "none" {
				continue
			}
			notes := strings.Split(note, "\n")
			for _, n := range notes {
				n = strings.Trim(n, "\r")
				breaking := false
				if strings.HasPrefix(n, "!") {
					breaking = true
					n = strings.TrimSpace(n[1:])
				}
				rn := ReleaseNote{
					Breaking:    breaking,
					Description: n,
					URI:         fmt.Sprintf("%s/%s/%s/pull/%d", defaultGitHubBaseURI, opts.Org, opts.Repo, num),
					Num:         num,
					Authors:     authors,
					MergedAt:    p.GetMergedAt(),
				}
				releaseNotes = append(releaseNotes, rn)
			}
		}
		if response.NextPage == 0 {
			break
		}
		listingOpts.ListOptions.Page = response.NextPage
	}
	return releaseNotes, nil
}

func GetAuthors(c *github.Client, ctx context.Context, opts *UpdateOptions, prNum int) (map[string]Author, error) {
	authors := make(map[string]Author)
	listOpts := &github.ListOptions{
		Page: 1,
	}
	for {
		commits, response, err := c.PullRequests.ListCommits(ctx, opts.Org, opts.Repo, prNum, listOpts)
		if _, ok := err.(*github.RateLimitError); ok {
			return nil, fmt.Errorf("hit rate limiting")
		}
		if err != nil {
			return nil, err
		}
		for _, commit := range commits {
			authors[commit.GetAuthor().GetLogin()] = Author{
				Login: commit.GetAuthor().GetLogin(),
				URL:   commit.GetAuthor().GetHTMLURL(),
			}
		}
		if response.NextPage == 0 {
			return authors, nil
		}
		listOpts.Page = response.NextPage
	}
}

func WriteFile(path string, notes []ReleaseNote, existingNotes []string, lastPrDate time.Time) {
	file, err := os.Create(path)
	if err != nil {
		logger.Fatalf("Cannot write file %s", path)
	}
	defer file.Close()
	fmt.Fprintln(file, "# Change Log")
	lastMonth := ""
	currentMonth := ""
	for _, note := range notes {
		currentMonth = note.MergedAt.Format("January 2006")
		if currentMonth != lastMonth {
			fmt.Fprintln(file, "\n##", currentMonth)
			lastMonth = currentMonth
		}
		breaking := ""
		if note.Breaking {
			breaking = " *BREAKING*"
		}
		authors := make([]string, len(note.Authors))
		i := 0
		for _, author := range note.Authors {
			authors[i] = fmt.Sprintf("[@%s](%s)", author.Login, author.URL)
			i++
		}
		sort.Strings(authors)
		line := fmt.Sprintf("-%s %s ([#%d](%s)) - %s", breaking, note.Description, note.Num, note.URI, strings.Join(authors, ", "))
		fmt.Fprintln(file, line)
	}

	if len(existingNotes) > 0 {
		currentMonth = lastPrDate.Format("January 2006")
		if currentMonth != lastMonth {
			fmt.Fprintln(file, "\n## ", currentMonth)
		}
		for _, note := range existingNotes {
			fmt.Fprintln(file, note)
		}
	}
}
