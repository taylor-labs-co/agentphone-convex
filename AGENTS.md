# Agent guidance

Follow the current Convex component authoring guidance. All component functions
must use object syntax with argument and return validators. Keep external I/O in
actions, component reads scoped and index-backed, and list operations bounded.
Regenerate component bindings after changing the public surface and run
`npm run verify` plus the disposable local deployment check before release.
