export async function fetchStarredReposPaged(username, token = '', page = 1, perPage = 30) {
  if (!username) {
    throw new Error('GitHub username is required.');
  }

  const url = `https://api.github.com/users/${encodeURIComponent(username)}/starred?page=${page}&per_page=${perPage}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json'
  };
  
  if (token && token.trim() !== '') {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  let res;
  try {
    res = await fetch(url, { headers, credentials: 'omit', redirect: 'error' });
  } catch (err) {
    throw new Error('Network error connecting to GitHub.', { cause: err });
  }

  if (res.status === 403 || res.status === 429) {
    const rateLimitRemaining = res.headers?.get('X-RateLimit-Remaining');
    if (rateLimitRemaining === '0') {
      throw new Error(
        'GitHub API rate limit exceeded. Please enter a Personal Access Token (PAT) in Settings to increase your rate limits, or try again later.'
      );
    }
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch stars from GitHub (HTTP ${res.status}): ${res.statusText}`);
  }

  const pageRepos = await res.json();
  if (!Array.isArray(pageRepos)) {
    throw new Error('GitHub API returned invalid data format.');
  }

  return pageRepos;
}

export async function fetchStarredRepos(username, token = '', maxStars = 150) {
  if (!username) throw new Error('GitHub username is required.');
  const repos = [];
  const perPage = 100;
  const limit = Math.min(maxStars, 500);
  for (let page = 1; (page - 1) * perPage < limit; page++) {
    const batch = await fetchStarredReposPaged(username, token, page, perPage);
    repos.push(...batch.filter(isPublicStar));
    if (batch.length < perPage) break;
  }
  return repos.slice(0, limit);
}

export function isPublicStar(repo) {
  return repo && !repo.private && (!repo.visibility || repo.visibility === 'public');
}
