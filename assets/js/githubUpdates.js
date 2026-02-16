/**
 * githubUpdates.js
 *
 * Fetches latest commits from the user's top 5 most recently active public repositories.
 * Aggregates them into a single chronological feed for the "Build in Public" system log.
 *
 * Caches results in localStorage for 10 minutes to avoid hitting API rate limits.
 */

const REPO_OWNER = 'robfiasco';
const CACHE_KEY = 'system_log_updates_multirepo';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function fetchGitHubUpdates() {
    const listElement = document.getElementById('systemLogFeed');
    if (!listElement) return;

    // 1. Check Cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            renderUpdates(data, listElement);
            return;
        }
    }

    // 2. Fetch Data from GitHub API
    try {
        // Show loading state if empty
        if (listElement.innerHTML.trim() === '') {
            listElement.innerHTML = '<li style="color: var(--muted);">Loading updates from all apps...</li>';
        }

        // Step A: Get top 5 most recently active repos
        const reposResponse = await fetch(`https://api.github.com/users/${REPO_OWNER}/repos?sort=pushed&direction=desc&per_page=5`);
        if (!reposResponse.ok) throw new Error('GitHub API Limit or Error (Repos)');
        const repos = await reposResponse.json();

        // Step B: Fetch latest commits for each repo (parallel)
        const commitPromises = repos.map(async (repo) => {
            const commitsUrl = `https://api.github.com/repos/${REPO_OWNER}/${repo.name}/commits?author=${REPO_OWNER}&per_page=5`;
            const response = await fetch(commitsUrl);
            if (!response.ok) return []; // Skip failed repos silently
            const commits = await response.json();

            return commits.map(commit => ({
                repo: repo.name,
                message: commit.commit.message.split('\n')[0], // First line
                date: new Date(commit.commit.author.date),
                sha: commit.sha,
                html_url: commit.html_url
            }));
        });

        const allCommitsResults = await Promise.all(commitPromises);

        // Step C: Flatten and Sort
        const allCommits = allCommitsResults.flat()
            .sort((a, b) => b.date - a.date) // Newest first
            .slice(0, 15); // Keep top 15

        // Step D: Format for Display
        const updates = allCommits.map(c => {
            return {
                repo: c.repo,
                date: c.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), // e.g. Feb 2026
                message: c.message,
                url: c.html_url
            };
        });

        // 3. Cache & Render
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: updates
        }));

        renderUpdates(updates, listElement);

    } catch (error) {
        console.error('System.log update failed:', error);
        // Fallback to cache if available
        if (cached) {
            const { data } = JSON.parse(cached);
            renderUpdates(data, listElement);
        } else {
            listElement.innerHTML = '<li style="color: var(--muted);">Unable to load activity feed.</li>';
        }
    }
}

// Export to global scope
window.fetchGitHubUpdates = fetchGitHubUpdates;

function renderUpdates(updates, container) {
    if (updates.length === 0) {
        container.innerHTML = '<li style="color: var(--muted);">No recent public activity found.</li>';
        return;
    }

    const html = updates.map(update => `
        <li>
            <span class="bullet">•</span>
            <span>
                <span style="opacity: 0.7; margin-right: 4px;">[${update.repo}]</span>
                ${update.date} — ${update.message}
            </span>
        </li>
    `).join('');

    container.innerHTML = html;
}
