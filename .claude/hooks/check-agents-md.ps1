#!/usr/bin/env pwsh
# Stop hook: nudge Claude to update AGENTS.md "Resume Here" block
# if commits were made this session but AGENTS.md wasn't touched.

$ErrorActionPreference = 'SilentlyContinue'

try {
    $raw = [Console]::In.ReadToEnd()
    if ($raw) {
        $inp = $raw | ConvertFrom-Json
        # Avoid infinite loops — if we already blocked once, let Claude stop.
        if ($inp.stop_hook_active) { exit 0 }
    }
} catch {}

# Most recent commit timestamp (unix epoch)
$lastCommit = git log -1 --format=%ct 2>$null
# Most recent commit that touched AGENTS.md
$lastDocCommit = git log -1 --format=%ct -- AGENTS.md 2>$null

if (-not $lastCommit) { exit 0 }
if (-not $lastDocCommit) { $lastDocCommit = 0 }

if ([int64]$lastCommit -gt [int64]$lastDocCommit) {
    $msg = "Commits exist newer than AGENTS.md. Per the Working Agreement in AGENTS.md, update the 'Resume Here' block (Last updated, Current focus, Last commit, Next concrete step) to reflect this session's work, then commit AGENTS.md before stopping."
    $out = @{ decision = "block"; reason = $msg } | ConvertTo-Json -Compress
    Write-Output $out
}

exit 0
