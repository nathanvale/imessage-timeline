# Research Assistant

Conduct thorough research on topics by searching the vault and synthesizing
findings.

## Process

1. **Initial Search**
   - Search the entire vault for the topic
   - Identify all relevant notes
   - Note gaps in existing knowledge

2. **Deep Dive**
   - Read all relevant notes thoroughly
   - Extract key insights and quotes
   - Identify contradictions or tensions
   - Map connections between ideas
   - Use MCP tools for external research if needed (see below)

3. **Synthesis**
   - Create a summary of findings
   - Highlight patterns and themes
   - Note questions that remain unanswered
   - Suggest areas for further research

### Available Research Tools

**Always Check First:** Look for MCP tools with names starting with `mcp__` as
they provide enhanced capabilities.

1. **Standard Web Tools** (always available):
   - `WebFetch` - Fetch and analyze specific URLs
   - `WebSearch` - Search the web for documentation and articles

2. **MCP Enhanced Research Tools** (check availability with /mcp or tool list):

   **Context7 MCP** - Library Documentation Expert:
   - `mcp__context7__resolve-library-id` - Find the exact library ID for any npm
     package or framework
   - `mcp__context7__get-library-docs` - Instant access to complete library
     documentation
   - Perfect for: API reference, checking latest versions, understanding
     function signatures
   - Example: Research React Router v7 loaders, SQLite WAL mode, Whisper API
     parameters

   **Tavily MCP** - Enhanced Structured Search:
   - `mcp__tavily-mcp__search` - More powerful than basic web search with
     structured extraction
   - Returns clean, relevant content without ads or clutter
   - Excellent for: Finding specific technical answers, research papers,
     benchmarks
   - Example: "SQLite performance with 1 million rows", "ADHD app UX patterns"

   **Firecrawl MCP** - Deep Web Scraping & Research:
   - `mcp__mcp-server-firecrawl__firecrawl_scrape` - Extract clean content from
     any URL
   - `mcp__mcp-server-firecrawl__firecrawl_search` - Search with automatic
     content extraction
   - `mcp__mcp-server-firecrawl__firecrawl_map` - Discover all URLs on a
     documentation site
   - Perfect for: Scraping entire documentation sites, extracting GitHub
     discussions, analyzing competitor features
   - Example: Map all Obsidian plugin docs, extract all Gmail API error codes,
     scrape ADHD research sites

3. **Parallel Research Coordination**:
   - Use `Task` tool to spawn multiple general-purpose agents
   - Each agent can leverage different MCP tools:
     - Agent 1: Context7 for official library docs
     - Agent 2: Tavily for structured community research
     - Agent 3: Firecrawl for deep-diving specific sites
   - Agents work in parallel and report back
   - Combine and synthesize all reports

## Output Structure

```markdown
# Research Summary: [Topic]

## Existing Knowledge

- What's already in the vault
- Key insights from previous work

## Key Themes

1. Theme 1
   - Supporting notes: [[note1]], [[note2]]
   - Key insight: ...
2. Theme 2
   - Supporting notes: [[note3]], [[note4]]
   - Key insight: ...

## Contradictions/Tensions

- Where ideas conflict
- Unresolved questions

## Gaps

- What's missing
- What to research next

## Connections

- Related topics: [[topic1]], [[topic2]]
- Surprising links: ...

## Recommended Next Steps

1. Specific research needed
2. Questions to explore
3. Experiments to try
```

## Tips

- Cast a wide net initially, then focus
- Look for surprising connections
- Don't ignore contradictions - they're often where insights live
- Always suggest concrete next actions
