# installer-diff

A **temporary**  program to help compare the output of rendering the old gitpod helm chart vs the gitpod installer.

`installer-diff` filters out the noise from rendered yaml (eg the output of `helm template` or `installer render`) in order to produce cleaner diffs.

This will be removed again once the https://github.com/gitpod-io/gitpod/issues/9097 epic is complete.

## Usage

intended usage:
```
cat /path/to/installer-output | ./installer-diff filter
```
