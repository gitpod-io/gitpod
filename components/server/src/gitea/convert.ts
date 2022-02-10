import { Repository } from '@gitpod/gitpod-protocol';
import { RepoURL } from '../repohost';
import { Gitea } from "./api";

export function convertRepo(repo: Gitea.Repository): Repository | undefined  {
  if (!repo.clone_url || !repo.name || !repo.owner?.login) {
    return undefined;
  }

  const host = RepoURL.parseRepoUrl(repo.clone_url)!.host;

  return {
    host,
    owner: repo.owner.login,
    name: repo.name,
    cloneUrl: repo.clone_url,
    description: repo.description,
    avatarUrl: repo.avatar_url,
    webUrl: repo.html_url, // TODO: is this correct?
    defaultBranch: repo.default_branch,
    private: repo.private,
    fork: undefined // TODO: load fork somehow
  }
}

// export function convertBranch(repo: Gitea.Repository): Branch | undefined  {

// }