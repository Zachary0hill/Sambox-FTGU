const normalize = (value) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const compact = (value) => value.replaceAll(' ', '');
const TAG_WEIGHT = 28;

function nearMatch(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length > b.length) [a, b] = [b, a];
  let n = 0;
  while (n < a.length && a[n] === b[n]) n++;
  if (a.length < b.length) return a.slice(n) === b.slice(n + 1);
  return a.slice(n + 1) === b.slice(n + 1) ||
    (a[n] === b[n + 1] && a[n + 1] === b[n] && a.slice(n + 2) === b.slice(n + 2));
}

function searchableFields(idea) {
  return [
    [32, [idea.title, idea.archiveProject?.job, idea.archiveProject?.title, idea.archiveProject?.client]],
    [TAG_WEIGHT, idea.tags || []],
    [24, [idea.hook, ...(idea.titleOptions || [])]],
    [18, [idea.brand, idea.pillar, idea.format, idea.type, ...(idea.platforms || [])]],
    [14, [idea.audience, idea.promise, idea.thumbnailBrief, ...(idea.body || [])]],
    [9, [
      idea.research?.summary, ...(idea.research?.findings || []), ...(idea.research?.next_steps || []),
      ...(idea.findings || []).flatMap((finding) => [finding?.title, finding?.author, finding?.source]),
      ...(idea.research?.sources || []).flatMap((source) => [source?.title, source?.snippet]),
    ]],
  ];
}

// A query needs a match for every term. Each term uses its strongest field so repeated
// words in long notes never outweigh a direct title or tag hit.
export function ideaSearch(query) {
  const tags = new Set();
  const phrase = normalize(query.replace(/#([\p{L}\p{N}\p{M}_-]+)/gu, (_, tag) => {
    const key = compact(normalize(tag));
    if (key) tags.add(key);
    return ' ';
  }));
  const terms = phrase ? [...new Set(phrase.split(' '))] : [];
  if (!terms.length && !tags.size) return null;
  const compound = compact(phrase);

  return (idea) => {
    const tagKeys = (idea.tags || []).filter((tag) => typeof tag === 'string')
      .map((tag) => compact(normalize(tag)));
    let score = 0;
    for (const tag of tags) {
      if (tagKeys.includes(tag)) score += 32;
      else if (tagKeys.some((key) => key.startsWith(tag))) score += 18;
      else return 0;
    }
    if (!terms.length) return score;

    // Research-generated tags collapse words (e.g. #behindthescenes).
    const compoundTag = tagKeys.includes(compound);
    const matches = terms.map(() => compoundTag ? TAG_WEIGHT : 0);
    let phraseBonus = 0;
    for (const [weight, values] of searchableFields(idea)) {
      const texts = values.filter((value) => typeof value === 'string').map(normalize);
      const words = [...new Set(texts.flatMap((value) => value.split(' ').filter(Boolean)))];
      terms.forEach((term, n) => {
        if (matches[n] >= weight) return;
        if (words.includes(term)) matches[n] = weight;
        else if (matches[n] < weight * 0.6 && words.some((word) => word.startsWith(term))) matches[n] = weight * 0.6;
        else if (weight === TAG_WEIGHT && term.length >= 4 && matches[n] < weight * 0.4 &&
          tagKeys.some((tag) => tag.includes(term))) matches[n] = weight * 0.4;
        else if (term.length >= 5 && matches[n] < weight * 0.3 && words.some((word) => nearMatch(term, word))) matches[n] = weight * 0.3;
      });
      if (terms.length > 1 && texts.some((value) => (' ' + value + ' ').includes(' ' + phrase + ' '))) {
        phraseBonus = Math.max(phraseBonus, weight * 0.5);
      }
    }
    return matches.every(Boolean) ? score + phraseBonus + matches.reduce((sum, match) => sum + match, 0) : 0;
  };
}
