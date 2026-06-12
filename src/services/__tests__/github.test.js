import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchStarredRepos, STAR_FETCH_CAP } from '../github';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function page(repos) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => repos
  };
}

function repoList(count, offset = 0) {
  return Array.from({ length: count }, (_, i) => ({ full_name: `o/r${offset + i}` }));
}

describe('GitHub Starred Repos Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should throw an error if username is not provided', async () => {
    await expect(fetchStarredRepos('')).rejects.toThrow('GitHub username is required.');
  });

  it('should construct the correct url and auth headers', async () => {
    mockFetch.mockResolvedValueOnce(page(repoList(2)));

    const repos = await fetchStarredRepos('testuser', 'gh_token ', 50);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/users/testuser/starred?page=1&per_page=100',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': 'token gh_token' // trimmed
        })
      })
    );
    expect(repos).toHaveLength(2);
  });

  it('should omit the Authorization header without a token', async () => {
    mockFetch.mockResolvedValueOnce(page(repoList(1)));
    await fetchStarredRepos('testuser');
    expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBeUndefined();
  });

  it('should paginate across pages and slice to the requested max', async () => {
    mockFetch
      .mockResolvedValueOnce(page(repoList(100)))
      .mockResolvedValueOnce(page(repoList(100, 100)));

    const repos = await fetchStarredRepos('testuser', '', 150);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('page=2');
    expect(repos).toHaveLength(150);
    expect(repos[149].full_name).toBe('o/r149');
  });

  it('should stop on a short page (end of stars)', async () => {
    mockFetch.mockResolvedValueOnce(page(repoList(37)));

    const repos = await fetchStarredRepos('testuser', '', 300);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(repos).toHaveLength(37);
  });

  it(`should enforce the ${STAR_FETCH_CAP}-star hard cap`, async () => {
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce(page(repoList(100, i * 100)));
    }

    const repos = await fetchStarredRepos('testuser', '', 9999);

    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(repos).toHaveLength(STAR_FETCH_CAP);
  });

  it('should return an empty list when the user has no stars', async () => {
    mockFetch.mockResolvedValueOnce(page([]));
    const repos = await fetchStarredRepos('testuser');
    expect(repos).toEqual([]);
  });

  it('should throw rate limit error if rate limit header is zero', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: { get: (h) => (h === 'X-RateLimit-Remaining' ? '0' : null) },
      json: async () => ({})
    });

    await expect(fetchStarredRepos('testuser')).rejects.toThrow('GitHub API rate limit exceeded.');
  });

  it('should throw error if HTTP status is not OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({})
    });

    await expect(fetchStarredRepos('testuser')).rejects.toThrow(
      'Failed to fetch stars from GitHub (HTTP 500): Internal Server Error'
    );
  });

  it('should wrap network errors with context', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(fetchStarredRepos('testuser')).rejects.toThrow(
      'Network error connecting to GitHub: Failed to fetch'
    );
  });

  it('should throw on non-array response bodies', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ message: 'unexpected' })
    });

    await expect(fetchStarredRepos('testuser')).rejects.toThrow(
      'GitHub API returned invalid data format.'
    );
  });
});
