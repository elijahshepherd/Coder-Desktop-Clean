import path from "node:path";

export const isPathInsideWorkspace = (workspaceRoot: string, candidatePath: string): boolean => {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(candidatePath);
  const relative = path.relative(root, target);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export const resolveWorkspacePath = (workspaceRoot: string, requestedPath: string): string => {
  const resolvedPath = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(workspaceRoot, requestedPath);

  if (!isPathInsideWorkspace(workspaceRoot, resolvedPath)) {
    throw new Error("That path is outside the selected workspace. Choose that folder as the workspace first.");
  }

  return resolvedPath;
};
