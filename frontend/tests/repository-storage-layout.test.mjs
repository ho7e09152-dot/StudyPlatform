import test from "node:test";
import assert from "node:assert/strict";
import {
  RECOMMENDED_STORAGE_LAYOUT,
  buildStoragePreview,
  getStorageFormatOptions,
  isRecommendedStorageLayout,
  isTemporalOrderValid,
  optimizeStorageFormats,
  placeStorageBlock,
  setStorageBlockFormat,
  validateStorageBasePath,
  validateStorageLayout,
} from "../lib/domain/repository-storage-layout.ts";

test("recommended layout uses a separate day block and produces a readable preview", () => {
  assert.deepEqual(validateStorageLayout(RECOMMENDED_STORAGE_LAYOUT), []);
  assert.equal(isRecommendedStorageLayout(RECOMMENDED_STORAGE_LAYOUT), true);
  assert.ok(buildStoragePreview("study", RECOMMENDED_STORAGE_LAYOUT).includes("study/2026/08/14/김서연.md"));
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
  assert.ok(validateStorageLayout(invalid).some((message) => message.includes("연도와 월")));
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
  assert.deepEqual(dateFile?.folderBlocks, ["YEAR", "MONTH", "NAME"]);
  assert.deepEqual(validateStorageLayout(dateFile), []);
  assert.ok(buildStoragePreview("study", dateFile).includes("study/2026/08/김서연/260814.md"));

  const nameFileAgain = placeStorageBlock(dateFile, "NAME", "file", 0);
  assert.deepEqual(nameFileAgain?.folderBlocks, ["YEAR", "MONTH", "DATE"]);
  assert.deepEqual(nameFileAgain?.fileNameBlocks, ["NAME"]);
  assert.deepEqual(validateStorageLayout(nameFileAgain), []);

  assert.equal(placeStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "ITEM", "file", 0), null);
  assert.equal(placeStorageBlock(RECOMMENDED_STORAGE_LAYOUT, "NAME", "folder", 0), null);
});

test("date and day expose independent format options", () => {
  assert.deepEqual(getStorageFormatOptions(RECOMMENDED_STORAGE_LAYOUT, "DATE")?.options.map(({ value }) => value), [
    "YYYY-MM-DD", "YYYYMMDD", "YY-MM-DD", "YYMMDD", "YYYY_MM_DD_KO", "YY_MM_DD_KO",
  ]);
  assert.deepEqual(getStorageFormatOptions(RECOMMENDED_STORAGE_LAYOUT, "DAY")?.options.map(({ value }) => value), ["DD", "DD_KO"]);
  const localized = setStorageBlockFormat(RECOMMENDED_STORAGE_LAYOUT, "DAY", "DD_KO");
  assert.ok(buildStoragePreview("study", localized).includes("study/2026/08/14일/김서연.md"));
});

test("custom base paths allow repository folders but reject traversal", () => {
  assert.equal(validateStorageBasePath("study/algorithm"), null);
  assert.equal(validateStorageBasePath(""), null);
  assert.match(validateStorageBasePath("study/../private"), /안전한 폴더 경로/);
});
