/**
 * githubUpdates.ts
 * 
 * Reference implementation for fetching and formatting GitHub commits.
 * Matches the logic used in assets/js/githubUpdates.js.
 */

interface CommitData {
    commit: {
        message: string;
        author: {
            date: string;
        };
    };
    sha: string;
}

interface Update {
    date: string;
    message: string;
    sha: string;
}

const REPO_OWNER = 'robfiasco';
const REPO_NAME = 'portfolio';
const ALLOWED_PREFIXES = ['ship:', 'build:', 'update:', 'log:'];

export async function fetchGitHubUpdates(): Promise<Update[]> {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=30`);

        if (!response.ok) {
            throw new Error('Failed to fetch commits');
        }

        const commits: CommitData[] = await response.json();

        const updates = commits
            .map(commit => {
                const message = commit.commit.message.split('\n')[0];
                const lowerMsg = message.toLowerCase();

                const prefix = ALLOWED_PREFIXES.find(p => lowerMsg.startsWith(p));

                if (!prefix) return null;

                let cleanMsg = message.substring(prefix.length).trim();
                cleanMsg = cleanMsg.charAt(0).toUpperCase() + cleanMsg.slice(1);

                const dateObj = new Date(commit.commit.author.date);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                return {
                    date: dateStr,
                    message: cleanMsg,
                    sha: commit.sha
                };
            })
            .filter((item): item is Update => item !== null)
            .slice(0, 6);

        return updates;

    } catch (error) {
        console.error('Error fetching updates:', error);
        return [];
    }
}
