import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndexing } from '../useIndexing';
import { fetchStarredRepos } from '../../services/github';
import { analyzeStars } from '../../services/aiAnalysis';

vi.mock('../../services/github', () => ({
  fetchStarredRepos: vi.fn()
}));
vi.mock('../../services/aiAnalysis', () => ({
  analyzeStars: vi.fn()
}));
vi.mock('../../utils/audio', () => ({
  audio: {
    playClick: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playFloppySeek: vi.fn(() => Promise.resolve())
  }
}));

const SETTINGS = {
  username: 'octocat',
  githubToken: '',
  maxStars: 50,
  provider: 'gemini',
  apiKey: 'k',
  model: 'm',
  customUrl: ''
};

const REPOS = [{ full_name: 'o/r1' }, { full_name: 'o/r2' }];

function logsText(result) {
  return result.current.logs.map(l => l.text).join('\n');
}

describe('useIndexing pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs fetch → AI → cache and hands results to onComplete', async () => {
    fetchStarredRepos.mockResolvedValueOnce(REPOS);
    analyzeStars.mockResolvedValueOnce({
      analysis: { 'o/r1': { category: 'C', summary: 's', related: [] } },
      meta: { total: 2, analyzed: 2, batches: 1, failedBatches: 0 }
    });
    const onComplete = vi.fn();
    const { result } = renderHook(() => useIndexing({ settings: SETTINGS, onComplete }));

    await act(async () => {
      await result.current.startIndexing();
    });

    expect(result.current.progress).toBe(100);
    expect(logsText(result)).toContain('SEMANTIC CONNECTIONS FORGED');
    expect(localStorage.getItem('gitstars.v2.repos')).toContain('o/r1');
    expect(onComplete).not.toHaveBeenCalled(); // 800ms reveal delay

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(onComplete).toHaveBeenCalledWith(REPOS, expect.objectContaining({ 'o/r1': expect.any(Object) }));
    expect(result.current.isIndexing).toBe(false);
  });

  it('reports a partial AI run as a warning, never as success', async () => {
    fetchStarredRepos.mockResolvedValueOnce(REPOS);
    analyzeStars.mockResolvedValueOnce({
      analysis: {},
      meta: { total: 2, analyzed: 1, batches: 2, failedBatches: 1 }
    });
    const { result } = renderHook(() => useIndexing({ settings: SETTINGS, onComplete: vi.fn() }));

    await act(async () => {
      await result.current.startIndexing();
    });

    expect(logsText(result)).toContain('PARTIAL AI MAP: 1/2');
    expect(logsText(result)).not.toContain('SEMANTIC CONNECTIONS FORGED');
  });

  it('surfaces GitHub failures with progress -1 and no completion', async () => {
    fetchStarredRepos.mockRejectedValueOnce(new Error('GitHub API rate limit exceeded.'));
    const onComplete = vi.fn();
    const { result } = renderHook(() => useIndexing({ settings: SETTINGS, onComplete }));

    await act(async () => {
      await result.current.startIndexing();
    });

    expect(result.current.progress).toBe(-1);
    expect(logsText(result)).toContain('SYSTEM ERROR: GitHub API rate limit exceeded.');
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(analyzeStars).not.toHaveBeenCalled();
  });

  it('skips AI without a key and completes with an empty analysis', async () => {
    fetchStarredRepos.mockResolvedValueOnce(REPOS);
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useIndexing({ settings: { ...SETTINGS, apiKey: '' }, onComplete })
    );

    await act(async () => {
      await result.current.startIndexing();
    });
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(analyzeStars).not.toHaveBeenCalled();
    expect(logsText(result)).toContain('NO AI API KEY PROVIDED');
    expect(onComplete).toHaveBeenCalledWith(REPOS, {});
  });
});
