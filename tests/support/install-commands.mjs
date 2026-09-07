import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../tools/plugin-package.mjs";

export const installationRepository = "hyeonsangjeon/my-ai-video-cut";
export const installationSelector = "video-editor@my-ai-video-cut";

const specifications = {
  copilot: {
    label: "GHCP",
    command: `copilot plugin marketplace add ${installationRepository} && copilot plugin install ${installationSelector}`,
  },
  codex: {
    label: "Codex",
    command: `codex plugin marketplace add ${installationRepository} && codex plugin add ${installationSelector}`,
  },
  claude: {
    label: "Claude Code",
    command: `claude plugin marketplace add ${installationRepository} --scope user && claude plugin install ${installationSelector} --scope user`,
  },
};

export function readInstallCommand(client) {
  const specification = specifications[client];
  assert(specification, `Unknown installation client: ${client}`);
  const readme = readFileSync(path.join(repositoryRoot, "README.md"), "utf8");
  const rows = [...readme.matchAll(/^\| ([^|\r\n]+) \| `([^`\r\n]+)` \|$/gm)]
    .filter((match) => match[1] === specification.label);
  assert.equal(rows.length, 1, `README must contain one install-command row for ${specification.label}`);
  const command = rows[0][2];
  assert.equal(command, specification.command, `Unexpected install command for ${specification.label}`);
  return command;
}

export function installCommandForBundle(client, bundle) {
  const quotedPath = "'" + bundle.replaceAll("'", "'\\''") + "'";
  return readInstallCommand(client).replace(installationRepository, quotedPath);
}
