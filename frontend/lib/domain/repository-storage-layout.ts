export type StorageLayoutBlock = "YEAR" | "MONTH" | "DATE" | "DAY" | "NAME" | "ITEM";
export type StorageYearFormat = "YYYY" | "YY" | "YYYY_KO" | "YY_KO";
export type StorageMonthFormat = "MM" | "M" | "YYYY-MM" | "YY-MM" | "MM_KO" | "M_KO" | "YYYY_MM_KO" | "YY_MM_KO";
export type StorageDateFormat = "YYYY-MM-DD" | "YYYYMMDD" | "YY-MM-DD" | "YYMMDD" | "YYYY_MM_DD_KO" | "YY_MM_DD_KO";
export type StorageDayFormat = "DD" | "DD_KO";

export interface RepositoryStorageLayout {
  folderBlocks: StorageLayoutBlock[];
  fileNameBlocks: StorageLayoutBlock[];
  yearFormat: StorageYearFormat;
  monthFormat: StorageMonthFormat;
  dateFormat: StorageDateFormat;
  dayFormat: StorageDayFormat;
  extension: "md";
}

export const RECOMMENDED_STORAGE_LAYOUT: RepositoryStorageLayout = {
  folderBlocks: ["YEAR", "MONTH", "DAY"],
  fileNameBlocks: ["NAME"],
  yearFormat: "YYYY",
  monthFormat: "MM",
  dateFormat: "YYMMDD",
  dayFormat: "DD",
  extension: "md",
};

export const STORAGE_BLOCK_LABEL: Record<StorageLayoutBlock, string> = {
  YEAR: "연도",
  MONTH: "월",
  DATE: "날짜",
  DAY: "일",
  NAME: "이름",
  ITEM: "항목",
};

const TEMPORAL_RANK: Partial<Record<StorageLayoutBlock, number>> = { YEAR: 0, MONTH: 1, DATE: 2, DAY: 2 };

export function isTemporalOrderValid(layout: RepositoryStorageLayout) {
  const all = [...layout.folderBlocks, ...layout.fileNameBlocks];
  if (all.includes("DATE") && all.includes("DAY")) return false;
  const temporal = layout.folderBlocks
    .filter((block) => TEMPORAL_RANK[block] !== undefined);
  return temporal.every((block, index) => index === 0 || TEMPORAL_RANK[temporal[index - 1]]! < TEMPORAL_RANK[block]!);
}

export function optimizeStorageFormats(layout: RepositoryStorageLayout): RepositoryStorageLayout {
  const blocks = [...layout.folderBlocks, ...layout.fileNameBlocks];
  const hasYear = blocks.includes("YEAR");
  const hasMonth = blocks.includes("MONTH");
  const hasDay = blocks.includes("DAY");
  const fullMonthFormats = ["YYYY-MM", "YY-MM", "YYYY_MM_KO", "YY_MM_KO"];
  const koreanMonth = layout.monthFormat.endsWith("_KO");
  const monthFormat = hasYear && fullMonthFormats.includes(layout.monthFormat) ? (koreanMonth ? "MM_KO" : "MM")
    : !hasYear && hasMonth && hasDay && !fullMonthFormats.includes(layout.monthFormat) ? (koreanMonth ? "YYYY_MM_KO" : "YYYY-MM")
    : layout.monthFormat;
  const dateFormat = ["YYYY-MM-DD", "YYYYMMDD", "YY-MM-DD", "YYMMDD", "YYYY_MM_DD_KO", "YY_MM_DD_KO"].includes(layout.dateFormat)
    ? layout.dateFormat : "YYMMDD";
  return { ...layout, monthFormat, dateFormat };
}

export interface StorageFormatOption {
  value: string;
  example: string;
}

export function getStorageFormatOptions(layout: RepositoryStorageLayout, block: StorageLayoutBlock): {
  title: string;
  description?: string;
  options: StorageFormatOption[];
} | null {
  const blocks = [...layout.folderBlocks, ...layout.fileNameBlocks];
  const hasYear = blocks.includes("YEAR");
  const hasDate = blocks.includes("DATE");
  const hasDay = blocks.includes("DAY");
  if (block === "YEAR") return {
    title: "연도 형식",
    options: [
      { value: "YYYY", example: "2026" }, { value: "YY", example: "26" },
      { value: "YYYY_KO", example: "2026년" }, { value: "YY_KO", example: "26년" },
    ],
  };
  if (block === "MONTH") {
    if (hasYear) return {
      title: "월 형식",
      description: "연도가 앞에서 구분되어 있어 월만 사용합니다.",
      options: [
        { value: "MM", example: "08" }, { value: "M", example: "8" },
        { value: "MM_KO", example: "08월" }, { value: "M_KO", example: "8월" },
      ],
    };
    const includeYearOnly = hasDay && !hasDate;
    return {
      title: "월 형식",
      description: includeYearOnly ? "연도 블록이 없어 월에 연도를 함께 저장합니다." : undefined,
      options: [
        { value: "YYYY-MM", example: "2026-08" },
        { value: "YY-MM", example: "26-08" },
        { value: "YYYY_MM_KO", example: "2026년-08월" },
        { value: "YY_MM_KO", example: "26년-08월" },
        ...(!includeYearOnly ? [
          { value: "MM", example: "08" }, { value: "M", example: "8" },
          { value: "MM_KO", example: "08월" }, { value: "M_KO", example: "8월" },
        ] : []),
      ],
    };
  }
  if (block === "DATE") {
    return {
      title: "날짜 형식",
      description: "폴더 위치와 관계없이 연도, 월, 일을 모두 표시합니다.",
      options: [
        { value: "YYYY-MM-DD", example: "2026-08-14" },
        { value: "YYYYMMDD", example: "20260814" },
        { value: "YY-MM-DD", example: "26-08-14" },
        { value: "YYMMDD", example: "260814" },
        { value: "YYYY_MM_DD_KO", example: "2026년-08월-14일" },
        { value: "YY_MM_DD_KO", example: "26년-08월-14일" },
      ],
    };
  }
  if (block === "DAY") return {
    title: "일 형식",
    description: "연도와 월을 별도 폴더로 사용할 때 일자만 표시합니다.",
    options: [{ value: "DD", example: "14" }, { value: "DD_KO", example: "14일" }],
  };
  return null;
}

export function setStorageBlockFormat(
  layout: RepositoryStorageLayout,
  block: StorageLayoutBlock,
  value: string,
): RepositoryStorageLayout | null {
  const config = getStorageFormatOptions(layout, block);
  if (!config?.options.some((option) => option.value === value)) return null;
  if (block === "YEAR") return optimizeStorageFormats({ ...layout, yearFormat: value as StorageYearFormat });
  if (block === "MONTH") return optimizeStorageFormats({ ...layout, monthFormat: value as StorageMonthFormat });
  if (block === "DATE") return optimizeStorageFormats({ ...layout, dateFormat: value as StorageDateFormat });
  if (block === "DAY") return optimizeStorageFormats({ ...layout, dayFormat: value as StorageDayFormat });
  return null;
}

export function placeStorageBlock(
  layout: RepositoryStorageLayout,
  block: StorageLayoutBlock,
  zone: "folder" | "file",
  rawIndex: number,
): RepositoryStorageLayout | null {
  const oldFolderIndex = layout.folderBlocks.indexOf(block);
  const oldFileIndex = layout.fileNameBlocks.indexOf(block);
  let folder = layout.folderBlocks.filter((value) => value !== block);
  let file = layout.fileNameBlocks.filter((value) => value !== block);
  if (zone === "file" && block !== "DATE" && block !== "NAME") return null;
  if (zone === "folder" && oldFileIndex >= 0) return null;
  if (zone === "file") {
    // A full DATE and a separate DAY describe the same calendar day. When DATE
    // replaces NAME as the file name, remove DAY instead of leaving an invalid,
    // redundant path behind.
    if (block === "DATE") folder = folder.filter((value) => value !== "DAY");
    const displaced = layout.fileNameBlocks[0];
    file = [block];
    if (displaced && displaced !== block) {
      const preferred = oldFolderIndex >= 0 ? Math.min(oldFolderIndex, folder.length) : folder.length;
      const insertions = [preferred, ...Array.from({ length: folder.length + 1 }, (_, index) => index)]
        .filter((value, index, values) => values.indexOf(value) === index);
      for (const insertion of insertions) {
        const swappedFolder = [...folder];
        swappedFolder.splice(insertion, 0, displaced);
        const swapped = { ...layout, folderBlocks: swappedFolder, fileNameBlocks: file };
        if (isTemporalOrderValid(swapped)) return optimizeStorageFormats(swapped);
      }
      return null;
    }
  }
  const movingWithinTarget = zone === "folder" ? oldFolderIndex : oldFileIndex;
  const index = movingWithinTarget >= 0 && rawIndex > movingWithinTarget ? rawIndex - 1 : rawIndex;
  const target = zone === "folder" ? folder : file;
  if (zone === "folder") target.splice(Math.max(0, Math.min(index, target.length)), 0, block);
  const candidate = { ...layout, folderBlocks: folder, fileNameBlocks: file };
  return isTemporalOrderValid(candidate) ? optimizeStorageFormats(candidate) : null;
}

export function moveStorageBlock(
  layout: RepositoryStorageLayout,
  zone: "folder" | "file",
  index: number,
  offset: number,
): RepositoryStorageLayout | null {
  const key = zone === "folder" ? "folderBlocks" : "fileNameBlocks";
  const blocks = [...layout[key]];
  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= blocks.length) return null;
  [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
  const candidate = { ...layout, [key]: blocks };
  return isTemporalOrderValid(candidate) ? optimizeStorageFormats(candidate) : null;
}

export function validateStorageLayout(layout: RepositoryStorageLayout): string[] {
  const all = [...layout.folderBlocks, ...layout.fileNameBlocks];
  const errors: string[] = [];
  if (layout.fileNameBlocks.length !== 1 || !["DATE", "NAME"].includes(layout.fileNameBlocks[0])) {
    errors.push("파일 이름은 날짜 또는 이름 중 하나를 선택해주세요.");
  }
  if (new Set(all).size !== all.length) errors.push("같은 블록은 한 번만 사용할 수 있어요.");
  const hasDateAndDay = all.includes("DATE") && all.includes("DAY");
  if (hasDateAndDay) errors.push("날짜와 일 블록은 함께 사용할 수 없습니다. 둘 중 하나만 선택해주세요.");
  else if (!isTemporalOrderValid(layout)) errors.push("시간 블록은 연도, 월, 날짜 또는 일 순서로 배치해주세요.");
  if (!all.includes("DATE") && !all.includes("DAY")) errors.push("날짜를 식별할 수 없습니다. 날짜 블록을 추가하거나 연도·월·일을 조합해주세요.");
  if (!all.includes("NAME")) errors.push("작성자를 식별할 수 없습니다. 이름 블록을 추가해주세요.");
  if (all.includes("DAY") && !all.includes("DATE")
    && !(all.includes("MONTH") && (all.includes("YEAR") || ["YYYY-MM", "YY-MM", "YYYY_MM_KO", "YY_MM_KO"].includes(layout.monthFormat)))) {
    errors.push("일 블록을 사용하려면 연도와 월을 함께 식별할 수 있어야 합니다.");
  }
  return errors;
}

export function validateStorageBasePath(value: string): string | null {
  const normalized = value.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return null;
  const segments = normalized.split("/");
  if (normalized.length > 240 || normalized.includes("\\") || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.toLowerCase() === ".git")) {
    return "학습 기록 위치를 저장소 안의 안전한 폴더 경로로 입력해주세요.";
  }
  if (normalized === ".study-workspace/config.yml" || normalized.startsWith(".study-workspace/config.yml/")) {
    return "Workspace 설정 파일은 학습 기록 위치로 사용할 수 없어요.";
  }
  return null;
}

export function isRecommendedStorageLayout(layout: RepositoryStorageLayout) {
  return JSON.stringify(layout) === JSON.stringify(RECOMMENDED_STORAGE_LAYOUT);
}

function values(layout: RepositoryStorageLayout, name: string, date: Date, item: string) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    YEAR: layout.yearFormat === "YY" ? String(year).slice(-2)
      : layout.yearFormat === "YYYY_KO" ? `${year}년`
      : layout.yearFormat === "YY_KO" ? `${String(year).slice(-2)}년` : String(year),
    MONTH: layout.monthFormat === "M" ? String(month)
      : layout.monthFormat === "YYYY-MM" ? `${year}-${pad(month)}`
      : layout.monthFormat === "YY-MM" ? `${String(year).slice(-2)}-${pad(month)}`
      : layout.monthFormat === "MM_KO" ? `${pad(month)}월`
      : layout.monthFormat === "M_KO" ? `${month}월`
      : layout.monthFormat === "YYYY_MM_KO" ? `${year}년-${pad(month)}월`
      : layout.monthFormat === "YY_MM_KO" ? `${String(year).slice(-2)}년-${pad(month)}월` : pad(month),
    DATE: layout.dateFormat === "YYYYMMDD" ? `${year}${pad(month)}${pad(day)}`
      : layout.dateFormat === "YY-MM-DD" ? `${String(year).slice(-2)}-${pad(month)}-${pad(day)}`
      : layout.dateFormat === "YYMMDD" ? `${String(year).slice(-2)}${pad(month)}${pad(day)}`
      : layout.dateFormat === "YYYY_MM_DD_KO" ? `${year}년-${pad(month)}월-${pad(day)}일`
      : layout.dateFormat === "YY_MM_DD_KO" ? `${String(year).slice(-2)}년-${pad(month)}월-${pad(day)}일`
      : `${year}-${pad(month)}-${pad(day)}`,
    DAY: layout.dayFormat === "DD_KO" ? `${pad(day)}일` : pad(day),
    NAME: name,
    ITEM: item,
  } satisfies Record<StorageLayoutBlock, string>;
}

export function buildStoragePreview(basePath: string, layout: RepositoryStorageLayout) {
  const dates = [new Date(2026, 7, 14), new Date(2026, 7, 15)];
  const names = ["김서연", "이민준"];
  const paths: string[] = [];
  for (const name of names) for (const date of dates) {
    const value = values(layout, name, date, "item-a1b2c3d4");
    const folders = layout.folderBlocks.map((block) => value[block]);
    const file = `${layout.fileNameBlocks.map((block) => value[block]).join("-")}.${layout.extension}`;
    paths.push([...basePath.split("/").filter(Boolean), ...folders, file].join("/"));
  }
  return [...new Set(paths)];
}
