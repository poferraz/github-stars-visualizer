import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchStarredReposPaged } from '../github';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('GitHub Stars Service - Paginated Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should throw an error if username is not provided', async () => {
    await expect(fetchStarredReposPaged('')).rejects.toThrow('GitHub username is required.');
  });

  it('should construct correct url and headers for fetch', async () => {
    const mockResponseData = [{ id: 1, name: 'repo-1' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponseData
    });

    const result = await fetchStarredReposPaged('user123', 'fake-token', 2, 10);
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/users/user123/starred?page=2&per_page=10',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': 'token fake-token'
        }
      }
    );
    expect(result).toEqual(mockResponseData);
  });

  it('should throw rate limit error if rate limit header is zero', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: {
        get: (name) => name === 'X-RateLimit-Remaining' ? '0' : null
      }
    });

    await expect(fetchStarredReposPaged('user123')).rejects.toThrow(
      'GitHub API rate limit exceeded.'
    );
  });

  it('should throw error if HTTP status is not OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: {
        get: () => null
      }
    });

    await expect(fetchStarredReposPaged('user123')).rejects.toThrow(
      'Failed to fetch stars from GitHub (HTTP 500): Internal Server Error'
    );
  });
});
