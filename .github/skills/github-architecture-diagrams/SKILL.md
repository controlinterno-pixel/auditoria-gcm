---
name: github-architecture-diagrams
description: 'Analyze a GitHub repository and create interactive software architecture diagrams grounded in its source. Use when asked to map, visualize, document, or explain a repository architecture, services, modules, data flows, or dependencies.'
argument-hint: 'GitHub repository URL and desired architecture focus, if any'
---

# GitHub Architecture Diagrams

Inspect a GitHub repository and turn verified architectural evidence into a clear, interactive diagram that helps a reader explore the system.

## Workflow

1. **Resolve the source.** Identify the repository URL, default branch, requested subdirectory, and architecture question. Use the available GitHub repository integration when it can access the source. Otherwise inspect the public repository through available repository browsing or source tools. For a private or inaccessible repository, explain the access limitation and ask for an authorized source or a local checkout; never invent repository contents.
2. **Set a narrow scope.** Inspect the README, manifests, deployment and infrastructure configuration, entry points, and only the source files needed to trace the requested system. Follow imports, API calls, event handlers, and data access to verify relationships. Do not infer runtime behavior from filenames alone.
3. **Build an evidence-backed model.** Group the system into useful layers such as clients, interfaces, services, persistence, external integrations, and deployment. Include only components and edges supported by inspected files. Distinguish confirmed facts from inferred or unknown details, and keep the diagram legible rather than exhaustive.
4. **Choose the deliverable.** Default to an interactive, standalone HTML artifact, without modifying the analyzed repository. Provide zoom and pan, selectable nodes with concise details and source-file links, and useful grouping or filtering when the graph warrants it. Integrate the diagram into the project's application only when the user explicitly requests that. For a quick document-only request, use a Mermaid diagram with links and a compact evidence list instead. Do not add a runtime dependency to the analyzed project just to produce a standalone diagram.
5. **Implement the interaction.** For standalone HTML, prefer native HTML/CSS/JavaScript or a suitable established graph library when the graph's complexity justifies it; keep the artifact self-contained unless the user requests otherwise. For app integration, reuse the project's existing visualization stack or an established library appropriate to the application. Keep node labels concise; provide a visible legend, relation direction, keyboard-accessible controls, and a reset or fit-to-view action. Avoid making the diagram dependent on a remote service unless requested.
6. **Validate against the source.** Check every displayed component and edge against the inspected code or configuration. Test that the artifact opens, controls work, labels remain readable, and source links resolve. For app integration, run the narrow relevant test/build and inspect the diagram at desktop and mobile widths when applicable.
7. **Report the result.** Link the artifact and summarize its scope, key architecture observations, and validation performed. Call out inaccessible areas, assumptions, and relationships that could not be verified. Never claim full repository coverage if only a subset was inspected.

## Diagram quality criteria

- Make direction and meaning explicit: distinguish calls, data movement, ownership, and deployment boundaries rather than using one ambiguous edge style.
- Keep the first view useful at a glance; reveal details on selection instead of crowding every node with prose.
- Use stable source links where available, preferably links to the relevant repository path and branch.
- Do not expose secrets or copy sensitive configuration values into the diagram.
- Treat dependency and architecture conclusions as evidence-based analysis, not as proof of security or runtime behavior.