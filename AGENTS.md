# AGENTS.md - Universal Instructions for Claude Code & Codex

## About This File

This file contains universal instructions that BOTH Claude Code and Codex CLI read automatically.
- Claude Code: Reads this file automatically
- Codex CLI: Reads this file automatically

## Project Preferences

### Programming Language
- Prefer TypeScript for type safety
- Use Bun for package management and running scripts
- Follow ESLint and Prettier configurations

### Code Style
- Use functional programming patterns where appropriate
- Prefer composition over inheritance
- Write self-documenting code with clear variable names
- Keep functions small and focused

### Git Workflow
- Create feature branches from main/master
- Write descriptive commit messages
- Create pull requests for review before merging to main

### Testing
- Write tests alongside new features
- Prefer unit tests for business logic
- Use integration tests for API endpoints
- Aim for high test coverage on critical paths

## Multi-Agent Coordination

When working as part of an agent team:
1. **Claim tasks explicitly** - Don't work on unassigned tasks
2. **Communicate progress** - Update task status regularly
3. **Ask questions** - When requirements are unclear, ask before implementing
4. **Share findings** - Report discoveries to the team lead and teammates
5. **Respect boundaries** - Focus on assigned tasks, avoid scope creep

## Security Best Practices

- Never commit API keys, secrets, or credentials
- Validate all user inputs at system boundaries
- Use parameterized queries to prevent SQL injection
- Sanitize output to prevent XSS attacks
- Implement proper authentication and authorization

## Common Patterns

### Error Handling
```typescript
// Prefer explicit error handling
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

### File Operations
- Always check if files exist before reading
- Use atomic writes for critical configurations
- Clean up temporary files after use

### CLI Best Practices
- Show clear error messages with actionable guidance
- Provide helpful output for success cases
- Use appropriate exit codes (0 for success, non-zero for errors)

@RTK.md
