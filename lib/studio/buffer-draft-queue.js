import { buildPostInput } from '../integrations/providers/buffer-post';

const RESULTS = {
  draft_created: 'Draft created', draft_pending: 'Handoff pending verification',
  draft_review: 'Needs verification', draft_failed: 'Handoff failed',
};

const assetLabel = asset => asset ? asset.name + ' · V' + asset.version : 'Version not recorded';

export function bufferDraftQueue(D, projects) {
  const channels = new Map(), byBrand = new Map();
  for (const c of D.buffer?.channels || []) {
    channels.set(c.channel_id, c);
    if (!c.draft_brand_id) continue;
    const group = byBrand.get(c.draft_brand_id) || [];
    group.push(c);
    byBrand.set(c.draft_brand_id, group);
  }
  const sent = new Set((D.buffer?.posts || []).filter(p => p.sent_at).map(p => p.post_id));
  const brands = new Map((D.brands || []).map(b => [b.id, b]));
  const accounts = new Map((D.accounts || []).map(a => [a.id, a.name]));
  const studioChannels = new Map((D.channels || []).map(c => [c.id, c]));
  const readiness = {}, rows = [];
  for (const project of projects) {
    const input = D.bufferReadiness?.[project.id];
    if (!input) continue;
    const reasons = [];
    const add = (control, label) => reasons.push({ control, label });
    if (!input.edit_approved) add('edit', 'Approve the edit');
    if (!input.asset_id) add('asset', 'Choose an approved Final');
    if (!input.brand_id) add('brand', 'Choose a linked brand');
    const mapped = byBrand.get(input.brand_id) || [];
    if (!mapped.length) add('destinations', 'Map a draft destination');
    for (const c of mapped) {
      const label = c.display_name || c.name || c.channel_id;
      const preflight = buildPostInput({ service: c.service, channelId: c.channel_id, title: project.title, text: '',
        media: { kind: 'video', url: 'https://example.invalid/approved.mp4' }, schedule: { mode: 'queue' } });
      if (c.is_locked || c.is_disconnected) add('destinations', 'Reconnect or unlock ' + label);
      else if (preflight.error) add('destinations', label + ' · ' + preflight.error);
    }
    if (!input.connected) add('connection', 'Connect Buffer');
    if (!input.workflow_live) add('workflow', 'Enable a Scheduled draft workflow');
    readiness[project.id] = reasons;
    const history = (D.bufferPubs?.[project.id] || []).filter(p => RESULTS[p.status]);
    const historyById = new Map(history.map(p => [p.channel_id, p]));
    const destinations = new Set([...mapped.map(c => c.channel_id), ...historyById.keys()]);
    if (!destinations.size) destinations.add('');
    const selected = input.asset_id ? { id: input.asset_id, name: input.asset_name, version: input.asset_version, createdAt: input.asset_created_at } : null;
    const brand = brands.get(input.brand_id);
    for (const id of destinations) {
      const pub = historyById.get(id);
      const submission = pub?.draft_submission;
      const reviews = pub?.draft_version_reviews || [];
      const effective = reviews.findLast(r => ['updated_in_buffer','replaced'].includes(r.decision)) || submission;
      const last = reviews.at(-1);
      const isSent = pub && sent.has(pub.buffer_post_id);
      const newer = selected && (!effective || ((effective.assetId || effective.id) !== selected.id &&
        (selected.version > effective.version || (selected.version === effective.version && Date.parse(selected.createdAt) > Date.parse(effective.createdAt)))));
      const mappedHere = mapped.some(c => c.channel_id === id);
      const reviewable = pub?.status === 'draft_created' && !isSent && mappedHere && input.edit_approved && newer;
      const needsReview = reviewable && !(last?.decision === 'keep' && last.assetId === selected.id);
      const channel = channels.get(id);
      const owner = accounts.get(studioChannels.get(project.channelId)?.owner_account_id);
      const hold = pub?.draft_update_hold;
      const result = hold ? 'Verify media update' : isSent ? 'Sent in Buffer' : needsReview ? 'Review approved Final' : pub ? RESULTS[pub.status] : reasons.length ? 'Setup needed' : 'Ready for Scheduled';
      rows.push({
        key: project.id + ':' + id, project, client: owner || accounts.get(brand?.account_id) || project.channel || 'Studio',
        brand: submission?.brand || brand?.name, destination: submission?.destination || channel?.display_name || channel?.name || id || 'Unmapped',
        service: channel?.service || pub?.service, result, reasons: pub ? [] : reasons,
        attention: pub ? (!!hold || !isSent && (pub.status !== 'draft_created' || !!needsReview)) : reasons.length > 0,
        error: hold?.error || pub?.error, autoReplace: !!submission && !hold && effective?.decision !== 'updated_in_buffer', postId: pub?.buffer_post_id, publication: pub?.id, submitted: pub ? assetLabel(submission) : null,
        effective: effective ? assetLabel(effective) : null, selected: selected ? assetLabel(selected) : null,
        selectedId: selected?.id, reviewable: !!reviewable, last, reviewCount: reviews.length,
      });
    }
  }
  return { readiness, rows };
}
