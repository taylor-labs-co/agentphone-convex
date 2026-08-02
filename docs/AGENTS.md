> For Mintlify product knowledge (components, configuration, writing standards),
> install the Mintlify skill: `npx skills add https://mintlify.com/docs`

# Documentation project instructions

## About this project

- This is the documentation site for `agentphone-convex`, the Convex component for [AgentPhone](https://agentphone.ai/)
- It is built on [Mintlify](https://mintlify.com)
- Pages are MDX files with YAML frontmatter
- Configuration lives in `docs.json`; a new page must be added to a navigation group there or it will not appear in the sidebar
- The repository root `README.md` and `src/client/` are the source of truth for the public API — verify method names, arguments, and behavior against them before documenting
- Use the Mintlify MCP server, `https://mcp.mintlify.com`, to edit content and settings via MCP
- Use the Mintlify docs MCP server, `https://www.mintlify.com/docs/mcp`, to query information about using Mintlify via MCP

## Terminology

- "component" is the `agentphone-convex` Convex component; "client" is the `AgentPhone` instance an app constructs from it
- "scope" is the component's record-isolation key, not an OAuth scope or a permission
- "local resources" / "resource mirrors" are the scoped Convex tables; "event history" is the separate immutable event log — do not conflate them
- "outbound queue" covers durable queued sends; a "direct send" is the un-queued action path

## Style preferences

- Use active voice and second person ("you")
- Keep sentences concise — one idea per sentence
- Use sentence case for headings
- Bold for UI elements: Click **Settings**
- Code formatting for file names, commands, paths, and code references

## Content boundaries

{/* Define what should and shouldn't be documented */}
{/* Example: Don't document internal admin features */}
