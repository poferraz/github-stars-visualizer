import { aiRouter } from './aiRouter';

function heuristicParse(text, repoNames) {
  const result = {};
  for (const repoName of repoNames) {
    const repoIndex = text.indexOf(repoName);
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
      related = matches.map(m => m[1].trim()).filter(name => repoNames.includes(name));
    }

    result[repoName] = { category, summary, related };
  }
  return result;
}

export async function analyzeStars({ repositories = [], provider, apiKey, model, customUrl, onProgress }) {
  if (repositories.length === 0) {
    return {};
  }

  if (onProgress) {
    onProgress('Formatting repository lists for AI input...', 'info', 45);
  }

  // Format repository list for the prompt to keep token size tiny
  const repoList = repositories.map(r => ({
    full_name: r.full_name,
    description: r.description ? r.description.slice(0, 150) : 'No description.',
    language: r.language || 'Unknown'
  }));

  const prompt = `You are a software engineer archivist. Analyze these GitHub repositories starred by a user:
${JSON.stringify(repoList, null, 2)}

Please group them into logical, high-level categories (e.g., "Web Dev Frameworks", "AI/ML Utilities", "DevOps & CI/CD", "Database Tools", "CLI Helpers", etc.).

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

  if (onProgress) {
    onProgress('Sending request to AI provider...', 'info', 50);
  }

  let rawResponse = '';
  try {
    rawResponse = await aiRouter.sendMessage({
      provider,
      apiKey,
      model,
      prompt,
      customUrl
    });
  } catch (err) {
    console.error('AI Router sendMessage failed:', err);
    if (onProgress) {
      onProgress(`⚠️ AI connection error: ${err.message}. Generating default graph structure...`, 'warning', 70);
    }
  }

  if (onProgress) {
    onProgress(`Received AI response (${rawResponse ? rawResponse.length : 0} chars). Cleaning and parsing...`, 'info', 75);
  }

  let parsed = {};
  const repoNames = repositories.map(r => r.full_name);

  if (rawResponse) {
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
      parsed = JSON.parse(cleanJson);
      if (onProgress) {
        onProgress('✓ Successfully parsed AI response.', 'success', 80);
      }
    } catch (err) {
      if (onProgress) {
        onProgress('⚠️ Standard JSON parse failed. Running heuristic auto-repair...', 'warning', 78);
      }
      try {
        parsed = heuristicParse(rawResponse, repoNames);
        if (Object.keys(parsed).length > 0 && onProgress) {
          onProgress(`✓ Heuristic repair succeeded! Restored structured data for ${Object.keys(parsed).length} repositories.`, 'success', 80);
        }
      } catch (recoveryErr) {
        console.error('Heuristic recovery failed:', recoveryErr);
      }
    }
  }

  // Normalization and Validation stage (ensures output format is always correct)
  const normalized = {};
  repositories.forEach(repo => {
    const originalEntry = parsed[repo.full_name];
    if (originalEntry && typeof originalEntry === 'object') {
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
          .filter(name => repoNames.includes(name) && name !== repo.full_name);
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

  return normalized;
}
