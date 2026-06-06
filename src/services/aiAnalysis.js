import { aiRouter } from './aiRouter';

export async function analyzeStars({ repositories = [], provider, apiKey, model, customUrl }) {
  if (repositories.length === 0) {
    return {};
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

  const rawResponse = await aiRouter.sendMessage({
    provider,
    apiKey,
    model,
    prompt,
    customUrl
  });

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
  } catch (err) {
    console.error('Failed to parse AI response as JSON. Raw output was:', rawResponse);
    throw new Error('AI did not return a valid JSON format. Please try again.');
  }
}
