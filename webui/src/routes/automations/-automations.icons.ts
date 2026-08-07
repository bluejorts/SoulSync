/**
 * Trigger/action emoji, lifted verbatim from _autoIcons in stats-automations.js.
 *
 * Extracted by evaluating the original object literal rather than retyping it —
 * the values are surrogate-pair emoji and hand-copying them silently mangles
 * variation selectors (the U+FE0F suffixes below).
 */
export const AUTOMATION_ICONS: Record<string, string> = {
  schedule: '⏱️',
  daily_time: '🕰️',
  weekly_time: '📅',
  app_started: '🚀',
  track_downloaded: '⬇️',
  batch_complete: '✅',
  watchlist_new_release: '🔔',
  playlist_synced: '🔄',
  playlist_changed: '✏️',
  process_wishlist: '📋',
  scan_watchlist: '👁️',
  scan_library: '🔄',
  refresh_mirrored: '📂',
  sync_playlist: '🔁',
  discover_playlist: '🔍',
  discovery_completed: '🔍',
  notify_only: '🔔',
  discord_webhook: '💬',
  pushbullet: '🔔',
  telegram: '✉️',
  webhook: '🌐',
  signal_received: '⚡',
  fire_signal: '⚡',
  run_script: '💻',
  wishlist_processing_completed: '✅',
  watchlist_scan_completed: '✅',
  database_update_completed: '🗄️',
  download_failed: '❌',
  download_quarantined: '⚠️',
  wishlist_item_added: '➕',
  watchlist_artist_added: '👤',
  watchlist_artist_removed: '👤',
  import_completed: '📥',
  mirrored_playlist_created: '📂',
  quality_scan_completed: '📊',
  duplicate_scan_completed: '🗂️',
  library_scan_completed: '📡',
  start_database_update: '🗄️',
  run_duplicate_cleaner: '🗂️',
  clear_quarantine: '🗑️',
  cleanup_wishlist: '🧹',
  update_discovery_pool: '🧭',
  start_quality_scan: '📊',
  backup_database: '💾',
  refresh_beatport_cache: '🎵',
  clean_search_history: '🗑️',
  clean_completed_downloads: '✅',
  full_cleanup: '🧹',
  playlist_pipeline: '🚀',
  monthly_time: '📅',
};

/** Anything unmapped falls back to the gear, as the vanilla card did. */
export const AUTOMATION_ICON_FALLBACK = '⚙️';

export function automationIcon(type: string | null | undefined): string {
  return AUTOMATION_ICONS[type ?? ''] ?? AUTOMATION_ICON_FALLBACK;
}

/** Notification/then-action label. Two carry their own icon inline. */
export function formatNotify(type: string | null | undefined): string {
  if (type === 'discord_webhook') return 'Discord';
  if (type === 'pushbullet') return 'Pushbullet';
  if (type === 'telegram') return 'Telegram';
  if (type === 'webhook') return 'Webhook';
  if (type === 'fire_signal') return '⚡ Signal';
  if (type === 'run_script') return '💻 Script';
  return type || '';
}
