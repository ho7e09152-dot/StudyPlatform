import test from "node:test";
import assert from "node:assert/strict";
import {
  RECOMMENDED_STORAGE_LAYOUT,
  addStorageBlock,
  buildStoragePreview,
  getStorageFormatOptions,
  isRecommendedStorageLayout,
  isTemporalOrderValid,
  optimizeStorageFormats,
  placeStorageBlock,
  setStorageBlockFormat,
  validateStorageBasePath,
  validateStorageLayout,
  validateStorageRecordName,
} from "../lib/domain/repository-storage-layout.ts";

test("recommended layout groups records by full month and day without an extra year folder", () => {
  assert.deepEqual(validateStorageLayout(RECOMMENDED_STORAGE_LAYOUT), []);
  assert.equal(isRecommendedStorageLayout(RECOMMENDED_STORAGE_LAYOUT), true);
  assert.ok(buildStoragePreview("study", RECOMMENDED_STORAGE_LAYOUT).includes("study/.study-workspace/config.yml"));
  assert.ok(buildStoragePreview("study", RECOMMENDED_STORAGE_LAYOUT).includes("study/2026-08/14/김서연.md"));
});

test("full date stays a full date even below a month folder", () => {
  const layout = optimizeStorageFormats({
    ...RECOMMENDED_STORAGE_LAYOUT,
    folderBlocks: ["MONTH", "DATE"],
    monthFormat: "MM",
    dateFormat: "YYMMDD",
  });
  assert.deepEqual(validateStorageLayout(layout), []);
  assert.ok(buildStoragePreview("study", layout).includes("study/08/260814/김서연.md"));
});

test("day requires an identifiable year and month hierarchy", () => {
  const invalid = { ...RECOMMENDED_STORAGE_LAYOUT, folderBlocks: ["MONTH", "DAY"], monthFormat: "MM" };
  assert.ok(validateStorageLayout(invalid).some((message) => message.includes("연도, 월, 일을 모두")));
  const valid = optimizeStorageFormats(invalid);
  assert.equal(valid.monthFormat, "YYYY-MM");
  assert.deepEqual(validateStorageLayout(valid), []);
});

test("temporal blocks reject reverse hierarchy and never combine full date with day", () => {
  assert.equal(isTemporalOrderValid({ ...RECOMMENDED_STORAGE_LAYOUT, folderBlocks: ["DAY", "MONTH"] }), false);
  assert.equal(placeStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "MONTH", "folder", 3), null);
  assert.equal(placeStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "DATE", "folder", 2), null);
  assert.ok(validateStorageLayout({
    ...RECOMMENDED_STORAGE_LAYOUT,
    folderBlocks: ["YEAR", "MONTH", "DATE", "DAY"],
  }).some((message) => message.includes("함께 사용할 수 없습니다")));
});

test("file name accepts exactly date or name and replaces the previous file block", () => {
  const dateFile = placeStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "DATE", "file", 0);
  assert.deepEqual(dateFile?.fileNameBlocks, ["DATE"]);
  assert.equal(dateFile?.folderBlocks.includes("DATE"), false);
  assert.deepEqual(dateFile?.folderBlocks, ["MONTH", "NAME"]);
  assert.deepEqual(validateStorageLayout(dateFile), []);
  assert.ok(buildStoragePreview("study", dateFile).includes("study/2026-08/김서연/260814.md"));

  const nameFileAgain = placeStorageBlock(dateFile, "NAME", "file", 0);
  assert.deepEqual(nameFileAgain?.folderBlocks, ["MONTH", "DATE"]);
  assert.deepEqual(nameFileAgain?.fileNameBlocks, ["NAME"]);
  assert.deepEqual(validateStorageLayout(nameFileAgain), []);

  assert.equal(placeStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "NAME", "folder", 0), null);
});

test("date and day expose independent format options", () => {
  assert.deepEqual(getStorageFormatOptions(RECOMMENDED_STORAGE_LAYOUT, "DATE")?.options.map(({ value }) => value), [
    "YYYY-MM-DD", "YYYYMMDD", "YY-MM-DD", "YYMMDD", "YYYY_MM_DD_KO_SPACE", "YY_MM_DD_KO_SPACE",
  ]);
  assert.deepEqual(getStorageFormatOptions(RECOMMENDED_STORAGE_LAYOUT, "DAY")?.options.map(({ value }) => value), ["DD", "DD_KO"]);
  const localized = setStorageBlockFormat(RECOMMENDED_STORAGE_LAYOUT, "DAY", "DD_KO");
  assert.ok(buildStoragePreview("study", localized).includes("study/2026-08/14일/김서연.md"));

  const spacedDate = setStorageBlockFormat(addStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "DATE"), "DATE", "YYYY_MM_DD_KO_SPACE");
  assert.ok(buildStoragePreview("study", spacedDate).includes("study/2026-08/2026년 08월 14일/김서연.md"));
});

test("month formats include compact year and month values", () => {
  const monthAndDay = {
    ...RECOMMENDED_STORAGE_LAYOUT,
    folderBlocks: ["MONTH", "DAY"],
    monthFormat: "YY-MM",
  };
  assert.deepEqual(getStorageFormatOptions(monthAndDay, "MONTH")?.options.map(({ value }) => value), [
    "YYYY-MM", "YY-MM", "YYYYMM", "YYMM", "YYYY_MM_KO", "YY_MM_KO",
  ]);
  const compact = setStorageBlockFormat(monthAndDay, "MONTH", "YYMM");
  assert.ok(buildStoragePreview("study", compact).includes("study/2608/14/김서연.md"));
});

test("palette click adds an available block and swaps mutually exclusive date blocks", () => {
  const withDate = addStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "DATE");
  assert.ok(withDate);
  assert.equal(withDate.folderBlocks.includes("DATE"), true);
  assert.equal(withDate.folderBlocks.includes("DAY"), false);
  assert.deepEqual(withDate.fileNameBlocks, ["NAME"]);
  assert.deepEqual(validateStorageLayout(withDate), []);

  const withDayAgain = addStorageBlock(withDate, "DAY");
  assert.ok(withDayAgain);
  assert.equal(withDayAgain.folderBlocks.includes("DAY"), true);
  assert.equal(withDayAgain.folderBlocks.includes("DATE"), false);
  assert.deepEqual(validateStorageLayout(withDayAgain), []);
});

test("custom base paths allow repository folders but reject traversal", () => {
  assert.equal(validateStorageBasePath("study/algorithm"), null);
  assert.equal(validateStorageBasePath(""), null);
  assert.match(validateStorageBasePath("study/../private"), /안전한 폴더 경로/);
  assert.match(validateStorageBasePath("/study"), /안전한 폴더 경로/);
  assert.match(validateStorageBasePath("study/.study-workspace"), /시스템 설정 폴더/);
  assert.equal(validateStorageBasePath("study/algorithm/"), null);
});

test("storage paths and record names reject Unicode format controls without restricting normal Unicode", () => {
  const formatCharacters = [
    "\u202A", "\u202B", "\u202C", "\u202D", "\u202E",
    "\u2066", "\u2067", "\u2068", "\u2069", "\u200B",
  ];
  for (const formatCharacter of formatCharacters) {
    assert.match(validateStorageBasePath(`study/${formatCharacter}algorithm`), /사용할 수 없는 문자/);
    assert.match(validateStorageRecordName(`김${formatCharacter}서연`), /사용할 수 없는 문자/);
  }
  assert.equal(validateStorageBasePath("학습/알고리즘😀"), null);
  assert.equal(validateStorageRecordName("김서연😀"), null);
});

test("preview uses one layout for session metadata and member submissions", () => {
  const dateFile = placeStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "DATE", "file", 0);
  assert.ok(dateFile);
  const preview = buildStoragePreview("study", dateFile);
  assert.ok(preview.includes("study/2026-08/260814/session.yml"));
  assert.ok(preview.includes("study/2026-08/김서연/260814.md"));
});

test("record names reject path separators instead of silently sanitizing", () => {
  assert.equal(validateStorageRecordName("김서연"), null);
  assert.match(validateStorageRecordName("김/서연"), /경로 구분자/);
  assert.match(validateStorageRecordName(".."), /경로 구분자/);
  assert.match(validateStorageRecordName(".study-workspace"), /경로 구분자/);
});
