## Content to XHS Card

When the user asks to turn an article, Markdown file, note, or long text into Xiaohongshu cards:

1. Read `<REPO_ROOT>/content-to-xhs-card/SKILL.md` and follow it as the task workflow.
2. Treat `<REPO_ROOT>/content-to-xhs-card` as `SKILL_ROOT` when running scripts.
3. Keep the user's source article, plan, JSON, and generated HTML in the user's current workspace. Use absolute paths when passing them to scripts.
4. Always show the complete card plan for confirmation before generating the final HTML unless the user explicitly asks to skip confirmation.
5. Do not request or store an API key for this repository. Do not upload the user's article to any service operated by this repository.

Replace `<REPO_ROOT>` with the absolute path of the cloned repository before use.
