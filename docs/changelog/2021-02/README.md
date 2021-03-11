# February 2021

## Synchronize Theia user settings with VS Code

We recently launched [support for VS Code](https://www.gitpod.io/blog/root-docker-and-vscode/#vs-code).

If you switch your editor to VS Code, your user settings and extensions configured in Theia will be synchronized with VS Code automatically when you start a new workspace.

**Interested in using VS Code as your default editor?**

You can define VS Code as your default editor in the _Feature Preview_ section in your [Gitpod Settings]().

**Contributors**: [@akosyakov](https://github.com/akosyakov), [@svenefftinge](https://github.com/svenefftinge)

## Miscellaneous

* [#3087](https://github.com/gitpod-com/gitpod/pull/3087) - Remove the privileged feature flag. Thanks to [@csweichel](https://github.com/csweichel), [@akosyakov](https://github.com/akosyakov)
* [#3175](https://github.com/gitpod-com/gitpod/pull/3175) - Fix Env Var context parsing. Thanks to [@AlexTugarev](https://github.com/AlexTugarev), [@csweichel](https://github.com/csweichel)
* [#3177](https://github.com/gitpod-com/gitpod/pull/3177) - [supervisor] Let supervisor fail when first IDE start fails. Thanks to [@corneliusludmann](https://github.com/corneliusludmann), [@csweichel](https://github.com/csweichel)
* [#3182](https://github.com/gitpod-com/gitpod/pull/3182) - [registry-facade] Remove feature flag. Thanks to [@csweichel](https://github.com/csweichel), [@corneliusludmann](https://github.com/corneliusludmann)
* [#3228](https://github.com/gitpod-io/gitpod/pull/3228) - Allow air-gap Gitpod installations. Thanks to [@corneliusludmann](https://github.com/corneliusludmann), [@geropl](https://github.com/geropl)
* Improved workspace startup time in high-load situations. Thanks to [@geropl](https://github.com/geropl)
* Started to [adopt the controller framework](https://kubernetes.io/docs/concepts/architecture/controller/) which will lead to Gitpod producing less load on the Kubernetes API. Thanks to [@aledbf](https://github.com/aledbf)
