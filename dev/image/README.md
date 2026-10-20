# Development image

The development image contains the toolchain used by Gitpod development
environments and most GitHub Actions jobs. Updating a tool in its Dockerfiles
does not update the image that is running the current build, so toolchain
changes sometimes require a two-stage rollout.

## Updating a tool

1. Update the tool pin in both `dev/image/Dockerfile` and
   `.devcontainer/Dockerfile`.
2. Remember that jobs in the current PR still run inside the old, hardcoded
   development image.
3. If the old tool prevents the PR from passing, temporarily install the fixed
   version immediately before the failing step in both
   `.github/workflows/build.yml` and `.github/workflows/branch-build.yml`.
4. Merge this bootstrap change and wait for the main build to publish the new
   image. Main images use
   `eu.gcr.io/gitpod-core-dev/dev/dev-environment:main-gha.<run>`; PR images use
   `eu.gcr.io/gitpod-dev-artifact/dev/dev-environment:<branch>-gha.<run>`.
5. In a follow-up PR, update every active workflow and `.gitpod.yml` consumer
   to the newly published main image with:

   ```shell
   scripts/update-dev-environment-image.sh main-gha.<run>
   ```

6. Remove the temporary bootstrap from both build workflows in that follow-up.

The updater intentionally changes only `.github/workflows/` and `.gitpod.yml`.
References in fixtures and tests represent test data and must remain unchanged.
Use `--check` to verify that every active reference already points at an image:

```shell
scripts/update-dev-environment-image.sh --check \
  eu.gcr.io/gitpod-core-dev/dev/dev-environment:main-gha.<run>
```
