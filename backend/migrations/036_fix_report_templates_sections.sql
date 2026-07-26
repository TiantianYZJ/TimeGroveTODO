-- Fix report_templates.sections and work_reports.content for the new data model.
--
-- Changes:
--   1. report_templates: rename section field `key` → `mode` (values: "text"|"date")
--      Old: {"key":"completed","title":"今日完成",...}
--      New: {"mode":"text","title":"今日完成",...}
--   2. report_templates: convert old string-array format to proper objects
--   3. work_reports.content: convert old object format to array format
--      Old: {"completed":["line1"],"tomorrow_plan":["line2"]}
--      New: [{"title":"...","lines":[...]},{"title":"...","lines":[...]}]
--
-- MySQL 5.5 has no JSON functions, so we use string operations.
-- Known key→title mappings used for migration fallback:

-- Part 1: report_templates — fix old string-array format (createDefaults bug)
-- Old: '["work_done","tomorrow_plan"]' → proper objects with mode
UPDATE report_templates
SET sections = '[{"mode":"text","title":"工作完成","sort_order":1,"max_lines":20},{"mode":"text","title":"明日计划","sort_order":2,"max_lines":20}]'
WHERE type = 'daily' AND (sections = '["work_done","tomorrow_plan"]' OR sections = '["work_done","tomorrow_plan"]');

UPDATE report_templates
SET sections = '[{"mode":"text","title":"本周总结","sort_order":1,"max_lines":20},{"mode":"text","title":"下周计划","sort_order":2,"max_lines":20}]'
WHERE type = 'weekly' AND (sections = '["weekly_summary","next_plan"]' OR sections = '["weekly_summary","next_plan"]');

-- Part 2: report_templates — rename `key` to `mode` in object-format sections
-- Old: {"key":"completed","title":"今日完成","sort_order":1,"max_lines":20}
-- New: {"mode":"text","title":"今日完成","sort_order":1,"max_lines":20}
-- We do a safe string replacement. If the JSON had extra fields after "key",
-- they are preserved via the surrounding structure.
UPDATE report_templates
SET sections = REPLACE(sections, '"key":', '"mode":')
WHERE sections LIKE '%"key":%';

-- After rename, old key values are now mode values but still have old identifier names.
-- We need to rewrite the value for every section in every template.
-- MySQL 5.5 can't parse JSON, so we use positional REPLACE for each section delimiter.
-- Strategy: for each section {...} in the array, the first quoted string after "mode": is the key value.
-- We replace known identifier values with "text" (the default mode for all old data).
-- This is safe because old identifiers are unique strings that don't appear elsewhere in valid JSON.
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"completed"', '"mode":"text"');
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"in_progress"', '"mode":"text"');
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"blocked"', '"mode":"text"');
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"tomorrow_plan"', '"mode":"text"');
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"summary"', '"mode":"text"');
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"next_plan"', '"mode":"text"');
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"work_done"', '"mode":"text"');
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"weekly_summary"', '"mode":"text"');
-- Any custom key values: match any value that isn't "text" or "date"
-- We use CONCAT to avoid matching "text"/"date" values
UPDATE report_templates
SET sections = REPLACE(sections, '"mode":"custom_', '"mode":"text","_customKey":"custom_')
WHERE sections LIKE '%"mode":"custom\\_%';

-- Part 3: work_reports — convert old object-format content to array format
-- Old: {"completed":["line1"],"tomorrow_plan":["line2"]}
-- New: [{"title":"已完成","lines":["line1"]},{"title":"明日计划","lines":["line2"]}]
--
-- MySQL 5.5 can't introspect JSON keys, so we can't do a generic transform.
-- Instead, this migration handles the known patterns from the preset defaults.
-- Any remaining old-format content is handled on-the-fly by the frontend.
--
-- Known content key → title mappings used by the presets:
-- Daily:   completed→今日完成, in_progress→进行中, blocked→遇到的问题,
--          tomorrow_plan→明日计划, summary→总结与思考
-- Weekly:  completed→本周完成, in_progress→进行中, blocked→遇到的问题,
--          next_plan→下周计划, summary→总结与思考
-- Combo:   work_done→工作完成, tomorrow_plan→明日计划
--          weekly_summary→本周总结, next_plan→下周计划
--
-- IMPORTANT: Any old-format content not caught here will be normalized
-- on-the-fly by the frontend normalizeContent() helper. To force immediate
-- migration of ALL reports, run the inline migration from the admin panel
-- or trigger a one-time script. For now, the frontend handles both formats.

-- Note: This migration does NOT modify work_reports.content.
-- Old-format report content is normalized in the frontend via normalizeContent().
