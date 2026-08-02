# Publishing

The public npm package is `agentphone-convex`. Publishing is intentionally
tag-driven: merging to `main` verifies the package but does not release it.

## npm trusted publishing

Configure an npm trusted publisher for:

- Organization or user: `taylor-labs-co`
- Repository: `agentphone-convex`
- Workflow: `publish.yml`

The workflow uses GitHub OIDC and `npm publish --provenance`; it does not need a
long-lived npm token.

## Release

1. Update `CHANGELOG.md` and the version in `package.json` and
   `package-lock.json`.
2. Run `npm ci`, `npm run verify`, and `npm pack --dry-run`.
3. Merge the release commit to `main` and wait for Verify to pass.
4. Tag that exact commit with the matching version, for example `v0.3.0`.
5. Push the tag. The Publish workflow verifies the tag/version match and then
   publishes with provenance.

The workflow can also be started manually after checking that the repository's
package version has not already been published.

Never place `AGENTPHONE_API_KEY` or a webhook signing secret in the package,
examples, npm configuration, or GitHub Actions.
