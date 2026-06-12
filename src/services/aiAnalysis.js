import { aiRouter } from './aiRouter';

// Batch size balances prompt+completion token limits against request count:
// ~40 repos keeps each completion comfortably inside every supported
// provider's output window, so responses stop truncating at scale.
const BATCH_SIZE = 40;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function heuristicParse(text, repoNames) {
  const repoNamesLowerMap = new Map(repoNames.map(name => [name.toLowerCase(), name]));
  const result = {};
  const lowerText = text.toLowerCase();
  for (const repoName of repoNames) {
    const repoIndex = lowerText.indexOf(repoName.toLowerCase());
    if (repoIndex === -1) continue;

    // Grab a chunk of text starting from this repository name (up to 1000 characters)
    const chunk = text.slice(repoIndex, repoIndex + 1000);

    // Extract category
    const categoryMatch = chunk.match(/['"]?category['"]?\s*:\s*['"]([^'"]+)['"]/i);
    const category = categoryMatch ? categoryMatch[1].trim() : 'General';

    // Extract summary (up to double quote following the colon, potentially multiline)
    const summaryMatch = chunk.match(/['"]?summary['"]?\s*:\s*['"]([\s\S]*?)['"]\s*(?:,|\n|\})/i);
    const summary = summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : 'No description available.';

    // Extract related array
    const relatedMatch = chunk.match(/['"]?related['"]?\s*:\s*\[([\s\S]*?)\]/i);
    let related = [];
    if (relatedMatch) {
      const relatedContent = relatedMatch[1];
      const matches = [...relatedContent.matchAll(/['"]([^'"]+)['"]/g)];
      related = matches
        .map(m => m[1].trim())
        .map(name => repoNamesLowerMap.get(name.toLowerCase()))
        .filter(name => name !== undefined);
    }

    result[repoName] = { category, summary, related };
  }
  return result;
}

function buildPrompt(batchRepos, seenCategories) {
  // Format repository list for the prompt to keep token size tiny
  const repoList = batchRepos.map(r => ({
    full_name: r.full_name,
    description: r.description ? r.description.slice(0, 150) : 'No description.',
    language: r.language || 'Unknown'
  }));

  // Cross-batch category consistency: later batches are nudged to reuse
  // category names already produced, so clusters don't fragment
  const reuseHint = seenCategories.size > 0
    ? `\nWhere appropriate, REUSE these existing category names for consistency: ${[...seenCategories].join(', ')}.\n`
    : '';

  return `You are a software engineer archivist. Analyze these GitHub repositories starred by a user:
${JSON.stringify(repoList, null, 2)}

Please group them into logical, high-level categories (e.g., "Web Dev Frameworks", "AI/ML Utilities", "DevOps & CI/CD", "Database Tools", "CLI Helpers", etc.).
${reuseHint}
For EACH repository in the list, provide:
1. A logical category name.
2. A 1-sentence plain-English summary of what this tool/project is and why it's useful.
3. An array of "related" repository names (must be chosen ONLY from the list of repositories provided above) that are similar, complementary, or can be used together.

Return the result STRICTLY as a valid JSON object matching this structure (no markdown wrapping, no backticks, just raw JSON text):
{
  "repo_full_name": {
    "category": "Category Name",
    "summary": "1-sentence summary.",
    "related": ["related_repo_full_name"]
  }
}
Make sure all repository names used as keys and in the related array match the input names exactly.`;
}

// Clean and parse one raw model response into an object keyed by repo name.
// Falls back to regex-based heuristic recovery; returns {} when hopeless.
function parseAiResponse(rawResponse, repoNames, onProgress) {
  if (!rawResponse) return {};

  // Extract JSON string if the model wrapped it in markdown codeblocks
  let cleanJson = rawResponse.trim();
  if (cleanJson.includes('```')) {
    // Matches ```json <json> ``` or just ``` <json> ```
    const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanJson = match[1].trim();
    }
  }

  const firstBrace = cleanJson.indexOf('{');
  const lastBrace = cleanJson.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas
  cleanJson = cleanJson.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleanJson);
  } catch {
    if (onProgress) {
      onProgress('⚠️ Standard JSON parse failed. Running heuristic auto-repair...', 'warning');
    }
    try {
      const recovered = heuristicParse(rawResponse, repoNames);
      if (Object.keys(recovered).length > 0 && onProgress) {
        onProgress(`✓ Heuristic repair succeeded! Restored structured data for ${Object.keys(recovered).length} repositories.`, 'success');
      }
      return recovered;
    } catch (recoveryErr) {
      console.error('Heuristic recovery failed:', recoveryErr);
      return {};
    }
  }
}

// Returns { analysis, meta }:
// - analysis: { [full_name]: { category, summary, related[] } } for EVERY
//   input repo (unanalyzed repos fall back to language/description defaults)
// - meta: { total, analyzed, batches, failedBatches } so callers can tell a
//   real AI map from a fallback instead of silently degrading
export async function analyzeStars({
  repositories = [],
  provider,
  apiKey,
  model,
  customUrl,
  onProgress,
  batchSize = BATCH_SIZE,
  retryDelayMs = RETRY_DELAY_MS
}) {
  if (repositories.length === 0) {
    return { analysis: {}, meta: { total: 0, analyzed: 0, batches: 0, failedBatches: 0 } };
  }

  const batches = chunk(repositories, batchSize);
  const parsed = {};
  const seenCategories = new Set();
  let failedBatches = 0;

  if (onProgress) {
    onProgress(`Formatting ${repositories.length} repositories into ${batches.length} batch(es) for AI input...`, 'info', 45);
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNames = batch.map(r => r.full_name);
    const prompt = buildPrompt(batch, seenCategories);
    const progressBase = 45 + Math.round(((i + 1) / batches.length) * 35); // 45 → 80

    let rawResponse = '';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (onProgress) {
          onProgress(
            `Sending batch ${i + 1}/${batches.length} (${batch.length} repos) to AI provider${attempt > 0 ? ` — retry ${attempt}` : ''}...`,
            'info',
            progressBase - 2
          );
        }
        rawResponse = await aiRouter.sendMessage({ provider, apiKey, model, prompt, customUrl });
        break;
      } catch (err) {
        console.error(`AI batch ${i + 1} attempt ${attempt + 1} failed:`, err);
        if (attempt < MAX_RETRIES) {
          await delay(retryDelayMs);
        } else {
          failedBatches += 1;
          if (onProgress) {
            onProgress(`⚠️ Batch ${i + 1}/${batches.length} failed after retry: ${err.message}. Affected repos fall back to language groups.`, 'warning', progressBase);
          }
        }
      }
    }

    if (rawResponse) {
      const batchParsed = parseAiResponse(rawResponse, batchNames, onProgress);
      Object.assign(parsed, batchParsed);
      Object.values(batchParsed).forEach((entry) => {
        if (entry && typeof entry.category === 'string' && entry.category.trim()) {
          seenCategories.add(entry.category.trim());
        }
      });
      if (onProgress) {
        onProgress(`✓ Batch ${i + 1}/${batches.length} parsed (${Object.keys(batchParsed).length} repos).`, 'success', progressBase);
      }
    }
  }

  // Normalization and Validation stage (ensures output format is always correct)
  const repoNames = repositories.map(r => r.full_name);
  const normalized = {};
  const repoNamesLowerMap = new Map(repoNames.map(name => [name.toLowerCase(), name]));
  const parsedKeysLowerMap = new Map(Object.keys(parsed).map(k => [k.toLowerCase(), k]));
  let analyzed = 0;

  repositories.forEach(repo => {
    let originalEntry = parsed[repo.full_name];
    if (!originalEntry) {
      const matchingKey = parsedKeysLowerMap.get(repo.full_name.toLowerCase());
      if (matchingKey) {
        originalEntry = parsed[matchingKey];
      }
    }

    if (originalEntry && typeof originalEntry === 'object') {
      analyzed += 1;
      const category = (typeof originalEntry.category === 'string' && originalEntry.category.trim())
        ? originalEntry.category.trim()
        : (repo.language || 'General');

      const summary = (typeof originalEntry.summary === 'string' && originalEntry.summary.trim())
        ? originalEntry.summary.trim()
        : (repo.description || 'No description available.');

      let related = [];
      if (Array.isArray(originalEntry.related)) {
        related = originalEntry.related
          .map(r => typeof r === 'string' ? r.trim() : '')
          .map(name => repoNamesLowerMap.get(name.toLowerCase()))
          .filter(name => name !== undefined && name !== repo.full_name);
      }

      normalized[repo.full_name] = { category, summary, related };
    } else {
      normalized[repo.full_name] = {
        category: repo.language || 'General',
        summary: repo.description || 'No description available.',
        related: []
      };
    }
  });

  if (onProgress) {
    const categories = new Set();
    let connectionsCount = 0;
    Object.values(normalized).forEach(item => {
      if (item.category) categories.add(item.category);
      if (Array.isArray(item.related)) connectionsCount += item.related.length;
    });
    onProgress(`🤖 AI identified ${categories.size} categories: ${Array.from(categories).join(', ')}`, 'success', 82);
    onProgress(`🔗 AI established ${connectionsCount} semantic connections between repositories.`, 'success', 84);
  }

  return {
    analysis: normalized,
    meta: {
      total: repositories.length,
      analyzed,
      batches: batches.length,
      failedBatches
    }
  };
}
