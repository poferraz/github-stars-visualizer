export function buildGraphData(repositories = [], aiAnalysis = {}, filters = {}) {
  const { languages, minStars } = filters;

  const filteredRepositories = repositories.filter((repo) => {
    if (minStars !== undefined && minStars !== null && (repo.stargazers_count || 0) < minStars) {
      return false;
    }
    if (languages && languages.length > 0) {
      const repoLang = repo.language || 'Unknown';
      const isMatched = languages.some(
        (lang) => lang.toLowerCase() === repoLang.toLowerCase()
      );
      if (!isMatched) {
        return false;
      }
    }
    return true;
  });

  const nodes = [];
  const links = [];
  const categories = new Set();

  // 1. Map aiAnalysis keys case-insensitively for lookups
  const aiAnalysisLowerMap = new Map();
  Object.entries(aiAnalysis || {}).forEach(([key, val]) => {
    aiAnalysisLowerMap.set(key.toLowerCase(), val);
  });

  // 2. Gather all unique categories
  filteredRepositories.forEach((repo) => {
    const analysis = aiAnalysisLowerMap.get(repo.full_name.toLowerCase());
    const category = (analysis && analysis.category) ? analysis.category.trim() : 'Uncategorized';
    categories.add(category);
  });

  // 3. Add category nodes
  categories.forEach((cat) => {
    nodes.push({
      id: cat,
      name: cat,
      type: 'category',
      val: 16, // Category nodes are larger and visually distinct
      color: '#ff00ff' // Neon magenta for categories
    });
  });

  // 4. Map lowercased full_name to original full_name for case-insensitive validation/resolution of semantic links
  const filteredRepoMap = new Map(filteredRepositories.map(r => [r.full_name.toLowerCase(), r.full_name]));

  // 5. Add repo nodes and category connections
  filteredRepositories.forEach((repo) => {
    const analysis = aiAnalysisLowerMap.get(repo.full_name.toLowerCase());
    const category = (analysis && analysis.category) ? analysis.category.trim() : 'Uncategorized';
    const summary = (analysis && analysis.summary) ? analysis.summary : (repo.description || 'No description provided.');

    // Calculate node size relative to star count (log scale)
    const starCount = repo.stargazers_count || 0;
    const nodeVal = Math.max(5, Math.log10(starCount + 1) * 3);

    // Repo node
    nodes.push({
      id: repo.full_name,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      summary: summary, // AI summary or fallback
      language: repo.language || 'Unknown',
      stars: starCount,
      forks: repo.forks_count || 0,
      url: repo.html_url,
      type: 'repo',
      val: nodeVal,
      color: getLanguageColor(repo.language)
    });

    // Link repo to its category
    links.push({
      source: repo.full_name,
      target: category,
      type: 'belongs_to'
    });

    // 6. Add semantic connections if they connect to other starred repos
    if (analysis && Array.isArray(analysis.related)) {
      analysis.related.forEach((relatedId) => {
        const resolvedRelatedId = filteredRepoMap.get(relatedId.toLowerCase());
        if (resolvedRelatedId) {
          // Avoid duplicate link in opposite direction to keep graph clean
          const linkExists = links.some(
            l => (l.source === resolvedRelatedId && l.target === repo.full_name) ||
                 (l.source === repo.full_name && l.target === resolvedRelatedId)
          );
          
          if (!linkExists) {
            links.push({
              source: repo.full_name,
              target: resolvedRelatedId,
              type: 'semantic_connection'
            });
          }
        }
      });
    }
  });

  return { nodes, links };
}

// Retro-palette coding colors based on language
function getLanguageColor(language) {
  if (!language) return '#808080'; // Dark Grey
  
  const colors = {
    javascript: '#f1e05a', // retro yellow
    typescript: '#3178c6', // bright blue
    python: '#3572a5', // green-blue
    go: '#00add8', // teal
    rust: '#dea584', // orange-copper
    html: '#e34c26', // red
    css: '#563d7c', // purple
    java: '#b07219', // brown
    c: '#555555', // grey
    'c++': '#f34b7d', // pink-red
    ruby: '#701516', // dark red
    php: '#4f5d95' // lavender-blue
  };

  const key = language.toLowerCase();
  return colors[key] || '#00ff00'; // Retro Terminal Green default
}
