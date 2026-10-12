// =========================================================================
// FIXED CATEGORY TO SUPREME MISSION AREA COUPLING (Sprint 6L Extension 4, schema version 53; Life added in 54)
// Seven fixed local categories (the Category lookup) each count toward one Supreme Faith in Action mission area,
// stored in Category.SupremeMissionArea by Seed.sql. The coupling is read-only: the event and activity forms show it as
// a badge beside the Local Category picker, and no form offers a way to override it. Meetings carry no category, and a
// grant request keeps its own overridable mission area (CharitableRequest.MissionAreaID).
// =========================================================================
import type { Category } from './types';

/** Supreme's four Faith in Action mission areas. */
export const SUPREME_MISSION_AREAS = ['Faith', 'Family', 'Community', 'Life'] as const;
export type SupremeMissionArea = (typeof SUPREME_MISSION_AREAS)[number];

/** The seven fixed local categories and their Supreme mission areas, exactly as Seed.sql writes them. */
export const FIXED_CATEGORY_MISSION_AREAS: Readonly<Record<string, SupremeMissionArea>> = {
  Fellowship: 'Family',
  Service: 'Community',
  'Faith Building': 'Faith',
  'Parish Community': 'Community',
  Fundraising: 'Community',
  Evangelization: 'Faith',
  Life: 'Life',
};

/** The fixed category names, in seed order; the lookup grid may not rename or delete them. */
export const FIXED_CATEGORY_NAMES = Object.keys(FIXED_CATEGORY_MISSION_AREAS);

/** Label of the read-only badge the entry forms show beside the Local Category picker. */
export const SUPREME_MISSION_AREA_BADGE_LABEL = 'Supreme Mission Area';

/** The category's stored Supreme mission area, or null for a category with no coupling (or no category). */
export function supremeMissionAreaOf(category: Pick<Category, 'SupremeMissionArea'> | null | undefined): SupremeMissionArea | null {
  const area = category?.SupremeMissionArea;
  return area != null && (SUPREME_MISSION_AREAS as readonly string[]).includes(area) ? (area as SupremeMissionArea) : null;
}

/**
 * Sprint 8F: the mission area an event's Local Category counts toward, for the calendar's colour coding. Null for an
 * event whose category has no coupling, a meeting (no category) or an unknown category id.
 */
export function missionAreaOfCategoryId(categoryId: number | null | undefined, categories: readonly Pick<Category, 'id' | 'SupremeMissionArea'>[]): SupremeMissionArea | null {
  if (categoryId == null) return null;
  return supremeMissionAreaOf(categories.find((c) => c.id === categoryId));
}

/** The CSS class (apps/web/app/globals.css) of a calendar block in each mission area. */
export const MISSION_AREA_CALENDAR_CLASS: Readonly<Record<SupremeMissionArea, string>> = {
  Faith: 'calendar-mission-faith',
  Community: 'calendar-mission-community',
  Family: 'calendar-mission-family',
  Life: 'calendar-mission-life',
};

/** The legend's colour names, in Supreme's order. */
export const MISSION_AREA_COLOR_NAMES: Readonly<Record<SupremeMissionArea, string>> = {
  Faith: 'Gold',
  Family: 'Green',
  Community: 'Blue',
  Life: 'Red',
};
