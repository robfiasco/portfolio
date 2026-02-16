/**
 * githubUpdates.js
 *
 * Fetches latest commits from the public GitHub API for the portfolio repo.
 * Filters by specific prefixes (ship:, build:, update:, log:) to show only
 * relevant "Build in Public" updates.
 *
 * Caches results in localStorage for 10 minutes to avoid hitting API rate limits.
 */

const REPO_OWNER = 'robfiasco';
const REPO_NAME = 'portfolio';
const CACHE_KEY = 'system_log_updates';
const CACHE_duration = 10 * 60 * 1000; // 10 minutes

// Allowed prefixes for public updates
const ALLOWED_PREFIXES = ['ship:', 'build:', 'update:', 'log:'];

async function fetchGitHubUpdates() {
    const listElement = document.getElementById('systemLogFeed');
    if (!listElement) return;

    // 1. Check Cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_duration) {
            renderUpdates(data, listElement);
            return;
        }
    }

    // 2. Fetch from GitHub API
    try {
        // Show loading state if empty
        if (listElement.innerHTML.trim() === '') {
            listElement.innerHTML = '<li style="color: var(--muted);">Loading updates...</li>';
        }

        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=30`);

        if (!response.ok) {
            throw new Error('GitHub API limit or error');
        }

        const commits = await response.json();

        // 3. Filter & Format
        const updates = commits
            .map(commit => {
                const message = commit.commit.message.split('\n')[0]; // First line only
                const lowerMsg = message.toLowerCase();

                // Find matching prefix
                const prefix = ALLOWED_PREFIXES.find(p => lowerMsg.startsWith(p));

                let cleanMsg = message;

                if (prefix) {
                    // Format: Remove prefix, capitalize first letter, clean text
                    cleanMsg = message.substring(prefix.length).trim();
                    cleanMsg = cleanMsg.charAt(0).toUpperCase() + cleanMsg.slice(1);
                } else {
                    // No prefix? Just show the message (fallback)
                    cleanMsg = message;
                }

                // Date Format: Month Year (e.g., Mar 2026)
                const dateObj = new Date(commit.commit.author.date);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                return {
                    date: dateStr,
                    message: cleanMsg,
                    sha: commit.sha
                };
            })
            .filter(Boolean) // Remove nulls
            .slice(0, 6); // Limit to latest 6

        // 4. Cache & Render
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: updates
        }));

        renderUpdates(updates, listElement);

    } catch (error) {
        console.error('System.log update failed:', error);
        // Fallback to cache if available, even if stale
        if (cached) {
            const { data } = JSON.parse(cached);
            renderUpdates(data, listElement);
        } else {
            listElement.innerHTML = '<li style="color: var(--muted);">New builds shipping soon.</li>';
        }
    }
}

// Export to global scope
window.fetchGitHubUpdates = fetchGitHubUpdates;

function renderUpdates(updates, container) {
    if (updates.length === 0) {
        container.innerHTML = '<li style="color: var(--muted);">New builds shipping soon.</li>';
        return;
    }

    const html = updates.map(update => `
        <li>
            <span class="bullet">•</span>
            <span>${update.date} — ${update.message}</span>
        </li>
    `).join('');

    container.innerHTML = html;
}
