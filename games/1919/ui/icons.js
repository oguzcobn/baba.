const ICON_PATHS={
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 save:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 3v7h10V3M7 21v-8h10v8"/>',
 files:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1.1-1 2.2M12 17.5h.01"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 coins:'<circle cx="9" cy="9" r="6"/><path d="M13 14a6 6 0 1 0 7-7M9 6v6M7 8h4"/>',
 chart:'<path d="M3 20h18M6 15l5-5 4 3 5-7"/>',
 swords:'<path d="m4 4 16 16M20 4 4 20M3 3l4 1-3 4M21 3l-4 1 3 4M3 21l1-4 4 3M21 21l-1-4-4 3"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
 book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15"/>',
 shield:'<path d="M12 2 20 6v6c0 5-3 8-8 10-5-2-8-5-8-10V6Z"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-4 4-4 14 0 18M12 3c4 4 4 14 0 18"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 minus:'<path d="M5 12h14"/>',
 pin:'<path d="M12 22s7-8 7-13A7 7 0 0 0 5 9c0 5 7 13 7 13Z"/><circle cx="12" cy="9" r="2"/>',
 arrow:'<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
 handshake:'<path d="M2 9 7 4l4 2 2-1 4 2 5 5-5 5-4-2-3 3-4-3-4-2Z"/>',
 close:'<path d="M5 5 19 19M19 5 5 19"/>'
};
function ico(id){return '<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICON_PATHS[id]||ICON_PATHS.shield)+'</svg>'}

export { ico };
