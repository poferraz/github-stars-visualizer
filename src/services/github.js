export async function fetchStarredRepos(username, token = '', maxStars = 150) {
  if (!username) {
    throw new Error('GitHub username is required.');
  }

  let repos = [];
  let page = 1;
  const perPage = 100; // fetch in large chunks to minimize network rounds
  const fetchLimit = Math.min(maxStars, 500); // safety cap to prevent browser lockup

  while (repos.length < fetchLimit) {
    const url = `https://api.github.com/users/${username}/starred?page=${page}&per_page=${perPage}`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    if (token && token.trim() !== '') {
      // Handles both classic and fine-grained GitHub PATs
      headers['Authorization'] = `token ${token.trim()}`;
    }

    let res;
    try {
      res = await fetch(url, { headers });
    } catch (err) {
      throw new Error(`Network error connecting to GitHub: ${err.message}`, { cause: err });
    }

    if (res.status === 403 || res.status === 429) {
      const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
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
    if (!Array.isArray(pageRepos) || pageRepos.length === 0) {
      break;
    }

    repos = repos.concat(pageRepos);
    
    // If the API returned fewer items than requested per page, we've reached the end of the user's stars
    if (pageRepos.length < perPage) {
      break;
    }
    
    page += 1;
  }

  // Slice to the requested max limit
  return repos.slice(0, fetchLimit);
}

export async function fetchStarredReposPaged(username, token = '', page = 1, perPage = 30) {
  if (!username) {
    throw new Error('GitHub username is required.');
  }

  const url = `https://api.github.com/users/${username}/starred?page=${page}&per_page=${perPage}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json'
  };
  
  if (token && token.trim() !== '') {
    headers['Authorization'] = `token ${token.trim()}`;
  }

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    throw new Error(`Network error connecting to GitHub: ${err.message}`, { cause: err });
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
