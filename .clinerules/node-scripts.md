## Brief overview
Guidelines for running Node.js scripts during development and debugging.

## Running Node scripts
- Never run Node.js code directly inline in the terminal (e.g., `node -e "..."`) as it breaks with complex multi-line scripts
- Instead, create a temporary script file (e.g., `/tmp/test-script.js`), run it with `node /tmp/test-script.js`, and delete the file afterward
- This applies to any exploratory/debugging scripts used during development
